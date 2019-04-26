import * as d3 from 'd3';

import DimensionBuilder from './dimensionBuilder';
import DimensionHierarchyController from './dimensionHierarchyController';

const DimensionGenerator = function() {

  let data; // dimension data this element is bound to

  let hierarchies;
  let dimensionBuilder;
  let dimensionHierarchyController;

  // flags indicating the sorting of categories
  let isSortedByDescription = false;
  let isSortedByValue = false;
  const isSortedByMinimization = false;

  let bestOrder; // latest order the dimension was sorted by (i.e. optimized for ribbon inters.)

  // flags indicating if dimension is on the very left or right
  let isFirst = false;
  let isLast = false;

  // scale for vertical positioning of elements. Domain and range are setup in dimension()
  let scaleY;

  // scale mapping a query length to a color --> ancestry tree gets a gradient
  const colorScale = d3.scaleLinear();

  let aggregateDimension;

  // D3 SELECTIONS
  let root; // the root selection (=parallelHierachy) the dimension is attached to

  // SVG CONFIGURATION
  let height = -1; // maximum vertical space for dimension, MUST be set
  let index = -1; // logical index relative to other dimensions
  const categoryWidth = 'ontouchstart' in document.documentElement ? 20 : 12; // width of dimension rect
  let categoryPadding = 50; // total vertical padding split between all categories
  let headerPadding = 120; // space between header and categories

  let x = -1;
  let y = -1;


  const dimension = function(selection) {
    if (index < 0) throw Error('dimension: index must be set and at least 0');
    if (scaleY == null) throw Error('dimension: scaleY must be set');
    if (data == null) throw Error('dimension: data must be set');

    root = selection;
    dimensionBuilder = new DimensionBuilder()
      .root(root)
      .dimension(dimension)
      .categoryWidth(categoryWidth)
      .headerPadding(headerPadding);

    dimensionHierarchyController = new DimensionHierarchyController()
      .dimension(dimension);

    colorScale.domain([0, data.levels.length]).range([data.color, '#969696']);

    draw();
  };

  /**
   * Draws all visual components of a dimension and creates event listeners.
   * @return {void}
   */
  let draw = function() {
    const hierarchy = dimensionHierarchyController.getHierarchy();
    dimensionBuilder.hierarchy(hierarchy);
    dimensionBuilder.drawHierarchy();
    dimensionBuilder.drawDimensionHeader();
  };

  dimension.update = function(useTransition = true) {
    dimensionHierarchyController.updateHierarchy();
    dimensionBuilder.updateHierarchy(useTransition);
  };

  dimension.sortHierarchyByValue = function() {
    isSortedByValue = !isSortedByValue;

    dimensionHierarchyController.sortHierarchy((a, b) => {
      if (isSortedByValue) return a.activeAggregateValue - b.activeAggregateValue;
      return b.activeAggregateValue - a.activeAggregateValue;
    });

    dimension.update();
    const sorting = isSortedByValue ? '▼' : '▲';
    dimensionBuilder.setDimensionHeaderSortingText(`Value ${sorting}`);
  };

  dimension.sortHierarchyByDescription = function() {
    isSortedByDescription = !isSortedByDescription;

    dimensionHierarchyController.sortHierarchy((a, b) => {
      const aBiggerB = a.data.value.descriptor < b.data.value.descriptor;

      if (isSortedByDescription) {
        if (aBiggerB) return 1;
        return -1;
      }

      if (aBiggerB) return -1;
      return 1;
    });

    dimension.update();
    const sorting = isSortedByDescription ? '▼' : '▲';
    dimensionBuilder.setDimensionHeaderSortingText(`Description ${sorting}`);
  };

  dimension.sortHierarchyByYPosition = function() {
    dimensionHierarchyController.sortHierarchy((a, b) => a.y - b.y);
    dimensionHierarchyController.updateYPositions();
    dimensionBuilder.setDimensionHeaderSortingText('Custom');
  };

  dimension.sortCategoriesRandomly = function() {
    dimensionHierarchyController.getHierarchy().each((d) => { d.randomPosition = Math.random(); });
    dimensionHierarchyController.sortHierarchy((a, b) => a.randomPosition - b.randomPosition);
    dimension.update();
    return dimensionHierarchyController.getHierarchy();
  };

  dimension.saveBestRandomPositions = function() {
    dimensionHierarchyController.getHierarchy()
      .each((d) => { d.bestRandomPosition = d.randomPosition; });
  };

  dimension.sortByBestRandomPositions = function() {
    dimensionHierarchyController
      .sortHierarchy((a, b) => a.bestRandomPosition - b.bestRandomPosition);

    dimension.update();
  };

  dimension.sortByOrdering = function(order = bestOrder) {
    bestOrder = order;
    dimensionHierarchyController
      .sortHierarchy((a, b) => order[a.data.value.descriptor] - order[b.data.value.descriptor]);

    dimension.update();
    dimensionBuilder.setDimensionHeaderSortingText('Minimized Intersections');
  };

  dimension.setCategoryHierarchy = function(categoryHierarchy) {
    dimensionHierarchyController.setHierarchy(categoryHierarchy);
    dimensionBuilder.hierarchy(dimensionHierarchyController.getHierarchy());
    dimension.update();
  };

  dimension.getCategoryHierarchy = function() {
    return dimensionHierarchyController.getHierarchy();
  };

  dimension.highlight = function(itemList) {
    dimensionBuilder.getObservedCategories().forEach((cat) => {
      cat.highlight(itemList);
    });
  };

  /**
   * Checks if a set of items is present in other active categories on other dimensions. This check
   * prevents adding terms to the query that yield an empty result set. If this term was the only
   * one left in a dimension, no items would be active and the visualization empty.
   * @param   {object} itemMap  mapping itemID --> item
   * @return  {boolean}         whether or not the set of items is present in active categories
   */
  dimension.itemsPassivelyPresentInAllOtherActiveDimensions = function(itemMap) {

    // no need to check this dimension, since no category than the one calling has these items
    const otherGenerators = hierarchies.getObservedDimensions().filter(dim => dim !== dimension);

    // for every other generator, get a list of true/false indicating whether or not they have an
    // active cateogry that shares any items from the itemMap
    const otherGeneratorsActiveList = otherGenerators
      .map(dim => dimensionHasActiveCategoryWithSharedItems(dim, itemMap));

    let itemsPassivelyPresent = true;
    otherGeneratorsActiveList.forEach((activeState) => {
      itemsPassivelyPresent = itemsPassivelyPresent && activeState;
    });

    return itemsPassivelyPresent;
  };

  let dimensionHasActiveCategoryWithSharedItems = function(dim, itemMap) {
    // dimension representing same one as this need not to be considered
    if (dim.data() === data) return true;

    const otherCategories = dim.getActiveLeafCategories();

    const categoryWithSharedItem = otherCategories.find(c => categorySharesItems(c, itemMap));

    return categoryWithSharedItem !== undefined;
  };

  let categorySharesItems = function(cat, itemMap) {
    const otherItems = cat.data().items;
    let hasSharedItems = false;

    Object.keys(otherItems).forEach((id) => {
      if (hasSharedItems) return;
      if (itemMap[id] !== undefined) hasSharedItems = true;
    });

    return hasSharedItems;
  };

  /**
   * Apply fisheye effect to this dimension if it is inside the transfomration's radius
   * @param   {object}  fisheye tranformation including focuspoint and radius
   * @return  {void}
   */
  dimension.fisheye = function(transformation) {
    if (transformation === null) {
      dimensionBuilder.fisheye(null);
    } else if (Math.abs(transformation.focus()[0] - x) < transformation.radius()) {
      dimensionBuilder.fisheye(transformation);
    } else {
      dimensionBuilder.fisheye(null);
    }
  };

  dimension.getActiveLeafCategories = function() {
    return dimensionBuilder.getObservedCategories()
      .filter(cat => cat.data().isQueryLeaf)
      .filter(cat => cat.height() > 0);
  };

  dimension.getaggregateDimensions = function() {
    return hierarchies.aggregateDimensions();
  };

  dimension.isSortedByDescription = function() { return isSortedByDescription; };

  dimension.isSortedByValue = function() { return isSortedByValue; };

  dimension.ancestorPadding = function() { return dimensionBuilder.ancestorPadding(); };

  dimension.getColor = function(queryTerms) {
    return colorScale(data.queryList.length - queryTerms.length);
  };


  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

  dimension.height = function(_) {
    if (!arguments.length) return height;
    if (typeof _ === 'number') height = _;
    else throw Error('dimension: height must be of type number');
    return dimension;
  };

  dimension.x = function(_) {
    if (!arguments.length) return x;
    if (typeof _ === 'number') x = _;
    else throw Error('dimension: x must be of type number');
    return dimension;
  };

  dimension.y = function(_) {
    if (!arguments.length) return y;
    if (typeof _ === 'number') y = _;
    else throw Error('dimension: y must be of type number');
    return dimension;
  };

  dimension.categoryPadding = function(_) {
    if (!arguments.length) return categoryPadding;
    if (typeof _ === 'number') categoryPadding = _;
    else throw Error('dimension: categoryPadding must be of type number');
    return dimension;
  };

  dimension.headerPadding = function(_) {
    if (!arguments.length) return headerPadding;
    if (typeof _ === 'number') headerPadding = _;
    else throw Error('dimension: headerPadding must be of type number');
    return dimension;
  };

  dimension.data = function(_) {
    if (!arguments.length) return data;
    if (typeof _ === 'object') data = _;
    else throw Error('dimension: data must be of type object');
    return dimension;
  };

  dimension.index = function(_) {
    if (!arguments.length) return index;
    if (typeof _ === 'number') index = _;
    else throw Error('dimension: index must be of type number');
    return dimension;
  };

  dimension.aggregateDimension = function(_) {
    if (!arguments.length) return aggregateDimension;
    if (typeof _ === 'string') aggregateDimension = _;
    else throw Error('dimension: aggregateDimension must be of type string');
    return dimension;
  };

  dimension.isFirst = function(_) {
    if (!arguments.length) return isFirst;
    if (typeof _ === 'boolean') isFirst = _;
    else throw Error('dimension: isFirst must be of type boolean');
    return dimension;
  };

  dimension.isLast = function(_) {
    if (!arguments.length) return isLast;
    if (typeof _ === 'boolean') isLast = _;
    else throw Error('dimension: isLast must be of type boolean');
    return dimension;
  };

  dimension.scaleY = function(_) {
    if (!arguments.length) return scaleY;
    if (typeof _ === 'function') scaleY = _;
    else throw Error('dimension: scaleY must be of type function');
    return dimension;
  };

  dimension.hierarchies = function(_) {
    if (!arguments.length) return hierarchies;
    if (typeof _ === 'function') hierarchies = _;
    else throw Error('dimension: hierarchies must be of type function');
    return dimension;
  };


  return dimension;
};

export default DimensionGenerator;