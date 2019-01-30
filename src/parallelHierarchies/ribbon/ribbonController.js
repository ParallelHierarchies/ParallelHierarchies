import * as d3 from 'd3';

import AdjacenciesController from './adjacenciesController';
import RibbonGenerator from './ribbon';
import ValueProvider from '../itemValueProvider';
import EventMediator from '../eventMediator';

const RibbonController = function() {
  const controller = {};

  let observedRibbons = []; // list of ribbon generators waiting for changes

  const adjacencyController = new AdjacenciesController();

  let root;

  let scaleY;

  let hierarchies;
  let itemList;
  let itemID;

  controller.init = function() {
    controller.updateAfterQueryChange();
    controller.updateActiveRibbons();
  };

  /**
   * Ribbons are links between categories of neighboring dimensions. Their height indicates the
   * percentage of elements in the dataset, that contain both the start and end category in their
   * respective categories.
   * @return {void}
   */
  controller.updateActiveRibbons = function() {

    // a list is easier to handle than the list adjacencies object, so use the flattened list
    // version (containing the same objects)
    const pathList = adjacencyController.getListOfPaths();

    // since pathList.map is evaluated before assigning to observedRibbons, observedRibbons will
    // not contain 'outdated' ribbons
    observedRibbons = pathList.map(getRibbonGeneratorForPath);

    const ribs = root.selectAll('.ribbon')
      .data(observedRibbons, d => `${d.source.data().descriptor}###${d.target.data().descriptor}`);

    ribs.enter()
      .append('g')
      .attr('class', 'ribbon')
      .each(function(rib) {
        d3.select(this).call(rib);
      });

    ribs.exit().remove();

    observedRibbons.forEach(r => r.update());
  };

  /**
   * Update the ribbons when a category is dragged.
   * @param {object} message identifies the dragged category by dimension and and excluded category
   */
  controller.updateVerticalRibbonPositions = function(excludeCategory, useTransition = true) {
    // update offsets and positions of ribbons
    updateRibbonOffsets();

    // message contains category data. Find all ribbons connected to this category and update
    // them, using the same transition as the categories to get a smooth, synchronized appearance
    observedRibbons.forEach((rib) => {
      rib.update(useTransition && rib.source !== excludeCategory && rib.target !== excludeCategory);
    });
  };

  /**
   * Updates the horizontal positions of all ribbons based on their connected categories.
   * @param   {boolean} useTransition whether or not to smooth the positioning
   * @return  {void}
   */
  controller.updateHorizontalRibbonPositions = function(useTransition = true) {
    observedRibbons.forEach((rib) => {
      rib.update(useTransition);
    });
  };

  /**
   * Based on the current queries, update the list of visible ribbons.
   * @param   {object}  positions list of positions that were changed to reduce calculations
   * @return  {void}
   */
  controller.updateAfterQueryChange = function() {
    // FIXME: use positions for speed
    // update which categories are connected
    adjacencyController.updateAfterQueryChange();

    // potentially derive an optimized layout
    if (hierarchies.useIntersectionMinimization()) {
      adjacencyController.minimizeIntersections();
    }

    // update offsets based on the connected categories and the layout
    updateRibbonOffsets();
  };

  controller.redraw = function() {
    root.selectAll('.ribbon').remove();
    observedRibbons.length = 0;
    controller.init();
  };

  /**
   * Returns a ribbon generator for the given path object. If a ribbon between source and target
   * category already exists, return that one. Otherwise create a new instance.
   * @param  {object}   path element of pathList in updateActiveRibbons()
   * @return {function}
   */
  let getRibbonGeneratorForPath = function(path) {
    const uncertaintyColor = ValueProvider
      .getUncertaintyColorForItemList(Object.values(path.items));

    const showsUncertainty = ValueProvider.ribbonUncertaintyMode === 2; // 2: color of ribbons shows unc.

    const existingRibbon = observedRibbons
      .find(rib => rib.source === path.source && rib.target === path.target);

    if (existingRibbon !== undefined) {
      existingRibbon.uncertaintyColor(uncertaintyColor);
      existingRibbon
        .data(path)
        .uncertaintyColor(uncertaintyColor)
        .showsUncertainty(showsUncertainty)
        .height(path.height);

      return existingRibbon;
    }

    const newRibbon = new RibbonGenerator()
      .data(path)
      .height(path.height)
      .uncertaintyColor(uncertaintyColor)
      .showsUncertainty(showsUncertainty)
      .scaleY(scaleY);

    newRibbon.source = path.source;
    newRibbon.target = path.target;

    return newRibbon;
  };

  /**
   * Uses the latest adjacency matrices and calculates ribbons connecting the particular categories
   * using the contained items to calculate their heights.
   * @return {void}
   */
  let updateRibbonOffsets = function() {
    const adjacencies = adjacencyController.getAdjacencies();

    let ribbonHeight = 0;

    // offsets are the vertical shift of ribbon to neighboring ribbons on the same category. There
    // are offsets at the source and target category of each ribbon
    let sourceOffset; // offset of ribbons on source category
    const targetOffsets = []; // offsets of ribbons on target categories per dimension-pair

    let sourceLabels;
    let targetLabels;

    const orders = getCategoryOrderMappingPerDimension();
    let adjacencyObj;
    let sum;

    // go through the adjacencies elementwise and accumulate the items into heights, then use this
    // value for offsets and aggregateDimensions and fill out the missing properties
    adjacencies.forEach((adjacency, i) => {

      targetOffsets.push({});

      sourceLabels = Object.keys(adjacency);
      sourceLabels.sort((a, b) => orders[i][a] - orders[i][b]);

      sourceLabels.forEach((source) => {
        sourceOffset = 0;

        targetLabels = Object.keys(adjacency[source]);
        targetLabels.sort((a, b) => orders[i + 1][a] - orders[i + 1][b]);

        targetLabels.forEach((target) => {

          if (targetOffsets[i][target] == null) {
            targetOffsets[i][target] = 0;
          }

          adjacencyObj = adjacency[source][target];

          const ribbonItemList = Object.values(adjacencyObj.items);
          const ribbonValue = ValueProvider.getActiveItemValueSumForAllAggregates(ribbonItemList);
          ribbonHeight = scaleY(ribbonValue);

          sourceOffset += ribbonHeight / 2;
          targetOffsets[i][target] += ribbonHeight / 2;

          // set the missing values in the adjacencies
          adjacencyObj.height = ribbonHeight;
          adjacencyObj.aggregateDimensions = sum;
          adjacencyObj.level = i;
          adjacencyObj.sourceOffset = sourceOffset;
          adjacencyObj.targetOffset = targetOffsets[i][target];

          sourceOffset += ribbonHeight / 2;
          targetOffsets[i][target] += ribbonHeight / 2;
        });
      });
    });
  };

  /**
   * Returns the vertical order in which categories appear in every observed dimension as list of
   * mappings from categoryName -> vertical order for each dimension.
   * @return {object} vertical order of categories per dimension as list of maps.
   */
  let getCategoryOrderMappingPerDimension = function() {
    const orderArrayList = [];

    hierarchies.getObservedDimensions().forEach((dim, i) => {

      const categoryOrder = dim.getActiveLeafCategories()
        .sort((a, b) => a.y() - b.y())
        .map(cat => cat.data().descriptor);

      orderArrayList[i] = categoryOrder;
    });

    const orderMapList = [];

    orderArrayList.forEach((orderArray) => {
      const orderMap = {};

      orderArray.forEach((cat, i) => {
        orderMap[cat] = i;
      });

      orderMapList.push(orderMap);
    });

    return orderMapList;
  };

  controller.optimizeIntersections = function(useGreedy = false) {
    adjacencyController.minimizeIntersections(useGreedy);
    controller.updateActiveRibbons();
    controller.updateVerticalRibbonPositions();
    EventMediator.notify('categoryOrderingChanged');
  };

  controller.getTotalNumberOfIntersections = function() {
    return adjacencyController.getTotalNumberOfIntersections();
  };

  controller.fisheye = function(transformation) {
    observedRibbons.forEach(rib => rib.fisheye(transformation));
  };

  controller.getObservedRibbons = function() {
    return observedRibbons;
  };

  // GETTERS AND SETTERS ///////////////////////////////////////////////////////////////////////////

  controller.hierarchies = function(_) {
    if (!arguments.length) return hierarchies;
    hierarchies = _;
    adjacencyController.hierarchies = _;
    return controller;
  };

  controller.itemList = function(_) {
    if (!arguments.length) return itemList;
    itemList = _;
    adjacencyController.itemList = _;
    return controller;
  };

  controller.itemID = function(_) {
    if (!arguments.length) return itemID;
    itemID = _;
    adjacencyController.itemID = _;
    return controller;
  };

  controller.scaleY = function(_) {
    if (!arguments.length) return scaleY;
    scaleY = _;
    return controller;
  };

  controller.root = function(_) {
    if (!arguments.length) return root;
    root = _;
    return controller;
  };

  return controller;
};

export default RibbonController;