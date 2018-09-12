import * as d3 from 'd3';

import Dimension from './dimension';
import EventMediator from '../eventMediator';
import ValueProvider from '../itemValueProvider';

const DimensionController = function() {
  const controller = {};

  let observedDimensions = []; // list of dimension generators waiting for changes
  let dimensionsData = {};

  let height = -1;

  let scaleX = d3.scaleLinear(); // scale for horizontal positioning
  let scaleY = d3.scaleLinear(); // scale for vertical positioning

  let itemList;
  let hierarchies;

  let margin;
  let dimensionHeaderPadding;

  const transitionDuration = 400;
  const transitionEasingFunction = d3.easePolyOut;

  let root;
  let dimension;
  let itemID;


  /**
   * Categories represent the possible values of a dimension. The bigger the category visually, the
   * more items contain this value for that dimesion.
   * In this function, the category generator is called on a <g> for every possible category.
   * @return {void}
   */
  const drawDimensions = function() {
    root.selectAll('.dimension')
      .data(observedDimensions, dim => dim.data().name + dim.index()).enter()
      .append('g')
      .attr('class', 'dimension grabbable')
      .each(function(d) { d3.select(this).call(d); });

    updateDimensionPositions();

    dimension = root.selectAll('.dimension');

    // dimensions can be dragged horizontally, they snap in place on dragend.
    dimension.call(dimensionDrag);

    dimension.selectAll('.category');
  };

  /**
   * Updates the position of active dimensions by moving them to the x position stored in the data.
   * @return {void}
   */
  let updateDimensionPositions = function() {
    root.selectAll('.dimension').each(function(d) {
      d3.select(this).transition()
        .ease(transitionEasingFunction)
        .duration(transitionDuration)
        .attr('transform', `translate(${d.x()},${d.y()})`);
    });
  };

  /**
   * Sets the isFirst and isLast state of a given dimension generator, based on its index.
   * @param   {function} dimensionGenerator element of observedDimensions
   * @return  {void}
   */
  const updateGeneratorIsFirstOrLast = function(dimensionGenerator) {
    if (observedDimensions.length === 1) {
      dimensionGenerator.isFirst(false).isLast(false);
    } else {
      dimensionGenerator
        .isFirst(dimensionGenerator.index() === 0)
        .isLast(dimensionGenerator.index() === observedDimensions.length - 1);
    }
  };

  /**
   * Draws all dimension that are marked as active. Only to be used when initializing the
   * controller, as it will draw every single dimension again.
   * @return {void}
   */
  controller.init = function() {
    const sortedDims = getSortedActiveDimensions();

    // initialize scales for positioning and length calculations
    scaleX
      .domain([0, sortedDims.length > 1 ? sortedDims.length - 1 : 1]);

    hierarchies.updateVerticalScaleDomain();

    // crate visual representations for each entry in sorteddimes
    observedDimensions = sortedDims.map(createDimensionGenerator);
    observedDimensions.forEach(updateHorizontalPositionOfGenerator);
    observedDimensions.forEach(updateGeneratorIsFirstOrLast);

    drawDimensions();
  };

  /**
   * Given a dimension object from the categorytree, this will return a dimension generator for an
   * instance of that dimension.
   * @param   {object} dimensionDataObj     dimension from the categorytree
   * @param   {number} horizontalIndex      vertical position in the visualization
   * @param   {number} noOfActiveDimensions total number of active dimensions
   * @return  {function}                    generator for dimension
   */
  let createDimensionGenerator = function(dimensionDataObj, horizontalIndex) {
    const noOfActiveDimensions = observedDimensions.length;
    const aggregateDimension = hierarchies.aggregateDimensions()[0];

    let xPosition = scaleX(horizontalIndex);
    if (noOfActiveDimensions === 0) xPosition = scaleX.range()[1] / 2;

    const dim = new Dimension()
      .aggregateDimension(aggregateDimension)
      .data(dimensionDataObj)
      .index(horizontalIndex)
      .isFirst(horizontalIndex === 0 && noOfActiveDimensions > 0)
      .isLast(horizontalIndex + 1 === noOfActiveDimensions && noOfActiveDimensions > 0)
      .x(xPosition)
      .y(0)
      .height(height - margin.top - margin.bottom)
      .headerPadding(dimensionHeaderPadding)
      .scaleY(scaleY)
      .hierarchies(hierarchies);

    return dim;
  };

  /**
   * Update what categories are active on any dimension after the user added or removed a term,
   * therefore also updating the heights of dimensions.
   * @return {void}
   */
  controller.updateDimensionsAfterQueryChange = function() {

    updateActiveItems();

    hierarchies.updateVerticalScaleDomain();

    observedDimensions.forEach(dim => dim.update());
  };

  controller.updateOnResize = function() {
    observedDimensions.forEach((dim) => {
      dim
        .height(height - margin.top - margin.bottom)
        .x(scaleX(dim.index()))
        .update();
    });

    updateDimensionPositions();
  };

  /**
   * Every dimension has an independent query and therefore a unique list of represented items. This
   * will update the 'active' state of items that are active for at least one query on every active
   * dimension.
   * TODO: PERFORMANCE PROBLEM WHEN UPDATING QUERY WITH 100k ITEMS
   * @return  {void}
   */
  let updateActiveItems = function() {
    const activeItems = {};

    itemList.forEach((item) => {
      item.active = false;
      activeItems[item[itemID]] = item;
    });

    let itemsActiveInDimension;
    let activeCategories;
    let activeQueries;
    const primaryAggregateDimension = ValueProvider.primaryAggregateDimension;
    const secondaryAggregateDimension = ValueProvider.secondaryAggregateDimension;

    // intersect the list of items active per dimension with the total list of items to get a list
    // of items that are active in every dimension.
    Object.values(dimensionsData).forEach((dim) => {

      // don't consider inactive dimensions
      if (dim.active.length === 0) return;

      // get active queries for this dimension
      activeQueries = hierarchies.getActiveQueries(dim.queryTree);

      // dimensions without any active query terms will not change the activeitems list
      if (activeQueries.length === 0) return;

      itemsActiveInDimension = {};
      activeCategories = getActiveCategories(dim);

      // get a list of all active items in this dimension. Since an item can only appear in one
      // category, itemsActiveInDimension contains no duplicates
      activeCategories.forEach((cat) => {
        Object.keys(cat.items).forEach((identifier) => {
          if (+cat.items[identifier].aggregateDimensions[primaryAggregateDimension] === 0) return;
          if (+cat.items[identifier].aggregateDimensions[secondaryAggregateDimension] === 0) return;

          itemsActiveInDimension[identifier] = cat.items[identifier];
        });
      });

      // intersect both lists: find all items in activeitems that are not part of
      // itemsActiveInDimension
      Object.keys(activeItems).forEach((identifier) => {
        if (itemsActiveInDimension[identifier] == null) delete activeItems[identifier];
      });
    });

    // set all active items to 'active' to reflect in the data that they match an active query for
    // every active dimension
    Object.keys(activeItems).forEach((identifier) => {
      activeItems[identifier].active = true;
    });
  };

  /**
   * Get a list of categories that are leaf nodes to the query of a dimension object from the
   * dimensionData.
   * @param   {object} dim element of dimensionData
   * @return  {object}     list of categories active for this dimension
   */
  let getActiveCategories = function(dim) {

    // active categories are those that match ONE of the active queries for this dimension
    const queries = hierarchies.getActiveQueries(dim.queryTree);
    let activeCategories = [];

    for (let q = 0; q < queries.length; q++) {
      activeCategories = activeCategories.concat(hierarchies.getCategories(dim, queries[q]));
    }

    // special case: no query is active. In that case, get the top-level categories
    if (queries.length === 0) activeCategories = hierarchies.getCategories(dim, []);

    return activeCategories;
  };

  /**
   * Returns a list of dimensions (duplicates possible) that are currently active sorted by their
   * positions in the active property
   * @return  {object}  list of active dimensions sorted by their index
   */
  let getSortedActiveDimensions = function() {

    // get all dimensions that are currently active
    const activeDimensions = [];
    Object.keys(dimensionsData).forEach((name) => {
      if (dimensionsData[name].active.length > 0) activeDimensions.push(dimensionsData[name]);
    });


    // create a sorted list of dimensions, using their indeces in the active property to set their
    // position
    const sortedDimensions = [];

    activeDimensions.forEach((dim) => {
      dim.active.forEach((index) => { sortedDimensions[index] = dim; });
    });

    return sortedDimensions.filter(d => d != null);
  };

    /**
   * Adds a new dimension to the parallelHierarchies.
   * @param  {}     message
   * @return {void}
   */
  controller.addDimension = function(message) {
    // make sure given dimension is valid by finding it in the list of available dimensions
    const newDim = dimensionsData[message.name];
    if (newDim == null) throw Error('parallelHierarchies: new dimension not found');

    const noOfActiveDims = observedDimensions.length;

    newDim.active.push(noOfActiveDims);

    // update horizontal scale before creating new generator
    scaleX.domain([0, noOfActiveDims]);

    const newGenerator = createDimensionGenerator(newDim, noOfActiveDims, noOfActiveDims);
    observedDimensions.push(newGenerator);
    observedDimensions.forEach(updateHorizontalPositionOfGenerator);

    drawDimensions();

    observedDimensions.forEach((dim) => {
      updateHorizontalPositionOfGenerator(dim);
      updateGeneratorIsFirstOrLast(dim);
      dim.update();
    });
  };

  /**
   * Removes a given dimension generator from parallelHierarchies.
   * @param  {}     message
   * @return {void}
   */
  controller.removeDimension = function(message) {
    if (observedDimensions.length === 2) {
      EventMediator.notify('error', 'Keep at least two active dimensions');
      return;
    }

    const visualIndex = observedDimensions.indexOf(message.dimension);
    const indexInObj = message.dimension.data().active.indexOf(visualIndex);

    // remove reference to the deleted dimension from the set of generators
    observedDimensions.splice(visualIndex, 1);
    // remove 'acitve' listing in the dimensionsData
    message.dimension.data().active.splice(indexInObj, 1);
    // clear query if no instance of this dimension is active
    if (message.dimension.data().active.length === 0) message.dimension.data().queryTree = {};

    // remove the visual component
    dimension.filter(dim => dim.index() === visualIndex).remove();

    // reduce index of dimension to the right of the removed one by 1
    Object.keys(dimensionsData).forEach((name) => {
      const dim = dimensionsData[name];
      for (let a = 0; a < dim.active.length; a++) {
        if (dim.active[a] > visualIndex) dim.active[a]--;
      }
    });

    observedDimensions.forEach((dim) => {
      if (dim.index() > visualIndex) dim.index(dim.index() - 1);
    });

    updateActiveItems();

    // update vertical scale
    hierarchies.updateVerticalScaleDomain();

    // update horizontal scale
    scaleX.domain([0, observedDimensions.length - 1]);
    observedDimensions.forEach((dim) => {
      updateHorizontalPositionOfGenerator(dim);
      updateGeneratorIsFirstOrLast(dim);
      dim.update();
    });

    updateDimensionPositions();
  };

  /**
   * Based on the index in the data, this will update the x() position of a dimension generator.
   * @param   {function} dimensionGenerator dimension generator
   * @return  {void}
   */
  let updateHorizontalPositionOfGenerator = function(dimensionGenerator) {
    let newX = scaleX(dimensionGenerator.index());
    if (observedDimensions.length === 1) newX = scaleX.range()[1] / 2;
    dimensionGenerator.x(newX);
  };

  /**
   * Propagate fisheye transformation to all active dimensions
   * @param   {object}  fisheye tranformation including focuspoint and radius
   * @return  {void}
   */
  controller.fisheye = function(transformation) {
    observedDimensions.forEach(dim => dim.fisheye(transformation));
  };

  // GETTERS AND SETTERS ///////////////////////////////////////////////////////////////////////////

  controller.hierarchies = function(_) {
    if (!arguments.length) return hierarchies;
    hierarchies = _;
    return controller;
  };

  controller.dimensionsData = function(_) {
    if (!arguments.length) return dimensionsData;
    dimensionsData = _;
    return controller;
  };

  controller.itemList = function(_) {
    if (!arguments.length) return itemList;
    itemList = _;
    return controller;
  };

  controller.itemID = function(_) {
    if (!arguments.length) return itemID;
    itemID = _;
    return controller;
  };

  controller.scaleX = function(_) {
    if (!arguments.length) return scaleX;
    scaleX = _;
    return controller;
  };

  controller.scaleY = function(_) {
    if (!arguments.length) return scaleY;
    scaleY = _;
    return controller;
  };

  controller.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return controller;
  };

  controller.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return controller;
  };

  controller.dimensionHeaderPadding = function(_) {
    if (!arguments.length) return dimensionHeaderPadding;
    dimensionHeaderPadding = _;
    return controller;
  };

  controller.root = function(_) {
    if (!arguments.length) return root;
    root = _;
    return controller;
  };


  // DRAG BEHAVIORS ////////////////////////////////////////////////////////////////////////////////

  const dimensionDrag = d3.drag()
    .on('start', function() {
      d3.select(this).classed('dragging', true);
    })
    .on('drag', function(d) {
      // add mouse delta x to current position of dragged dimension
      d.x(d.x() + d3.event.dx);

      // do not anmiate the dragged dimension but keep it right below the cursor instead
      d3.select(this).attr('transform', `translate(${d.x()},${d.y()})`);

      // index of dragged dimension inferred through the new horizontal position
      const newIndex = Math.max(Math.round(scaleX.invert(d.x())), 0);
      const previousIndex = d.index();

      // if the index changed, find the dimension that was formerly at the new index and swap
      // places, both in the dimensionsData and the dimension generators
      if (previousIndex === newIndex) {
        EventMediator.notify('dimensionDragged', { dimension: d });
      } else {
        const dimensionOnOldPosition = observedDimensions[newIndex];
        const dimensionOnOldPositionIndex = dimensionOnOldPosition.data().active.indexOf(newIndex);
        dimensionOnOldPosition.data().active[dimensionOnOldPositionIndex] = previousIndex;
        dimensionOnOldPosition.index(previousIndex);
        dimensionOnOldPosition.isFirst(previousIndex === 0);
        dimensionOnOldPosition.isLast(previousIndex === observedDimensions.length - 1);

        d.data().active[d.data().active.indexOf(previousIndex)] = newIndex;
        d.index(newIndex);
        d.isFirst(newIndex === 0);
        d.isLast(newIndex === observedDimensions.length - 1);

        observedDimensions[previousIndex] = dimensionOnOldPosition;
        observedDimensions[newIndex] = d;

        // make the other dimension move to the old position
        dimension.filter(dim => dim.index() === previousIndex)
          .transition()
          .duration(transitionDuration)
          .ease(transitionEasingFunction)
          .attrTween('transform', (dim) => {
            const oldPosition = scaleX(previousIndex);
            const newPosition = scaleX(newIndex);
            const positionInterpolation = d3.interpolateNumber(newPosition, oldPosition);

            return (t) => {
              dim.x(positionInterpolation(t));
              EventMediator.notify('dimensionDragged', { dimension: d });
              return `translate(${dim.x()},${dim.y()})`;
            };
          })
          .on('end', () => {
            EventMediator.notify('dimensionPositionChanged', { positions: [previousIndex, newIndex] });
          });

        dimensionOnOldPosition.update();
        d.update();
        EventMediator.notify('dimensionPositionChanged', { positions: [previousIndex, newIndex] });
      }
    })
    .on('end', function(d) {

      let xPosition = scaleX(d.index());
      if (observedDimensions.length === 1) xPosition = scaleX.range()[1] / 2;
      d.x(xPosition);

      d3.select(this)
        .transition()
        .duration(transitionDuration)
        .ease(transitionEasingFunction)
        .attr('transform', `translate(${d.x()},${d.y()})`);

      d3.select(this).classed('dragging', false);

      EventMediator.notify('dimensionDragEnd', { dimension: d });
    });

  controller.getObservedDimensions = function() {
    return observedDimensions;
  };

  return controller;
};

export default DimensionController;