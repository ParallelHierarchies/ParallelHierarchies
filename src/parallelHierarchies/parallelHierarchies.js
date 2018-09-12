import * as d3 from 'd3';

import UtilityModule from './utils';
import EventMediator from './eventMediator';
import ItemValueProvider from './itemValueProvider';

import DimensionController from './dimension/dimensionController';
import RibbonController from './ribbon/ribbonController';
import DataConverter from './data/dataConverter';
import FisheyeComponent from '../plugins/d3.fisheye';


export default function HierarchiesFacade() {

  let itemList = []; // list of items loaded and preprocessed by dataprovider
  const dimensionsData = {}; // metadata for dimensions (name, categories, query, active)

  let dataConverter;

  let dimensionController;
  let ribbonController;

  let dataProvider; // loads the data and allows access to data
  let ui; // interface controller
  let fisheye; // distortion feature

  let itemID; // unique identifier for single items
  let initialDimensions = []; // list of dimensions to be displayed when app starts

  const scaleX = d3.scaleLinear(); // scale for horizontal positioning
  const scaleY = d3.scaleLinear(); // scale for vertical positioning

  const utilityModule = new UtilityModule();

  const defaultColors = ['steelblue']; // default color set only includes one color
  let color = d3.scaleOrdinal(); // scale used to color dimensions

  let aggregateDimensions = [];

  // const fisheye = d3.fisheye.circular().radius(200).distortion(5);
  let useCategoryFisheye = true;
  let useCategoryDragging = !useCategoryFisheye;
  let useIntersectionMinimization = true;
  let useGreedyOptimization = false;

  // D3 SELECTIONS
  let svgContainer; // <svg> selection the parallelHiearchies are drawn onto
  let root; // <g> selection that every child-component of the visualization is attached to
  let dimensions; // <g> selection that contains all dimensions
  let ribbons;

  // SVG configuration
  let width = 1600; // maximum horizontal space of visualization
  let height = 900; // maximum vertical space of visualization
  const margin = {
    'left': 100, 'top': 120, 'right': 100, 'bottom': 100,
  };
  const dimensionHeaderPadding = 150;

  const hierarchies = function(selection) {
    if (dataProvider == null) throw Error('parallelHierarchies: dataProvider not set');

    itemID = dataProvider.itemID();

    dimensionController = getDimensionControllerInstance();
    ribbonController = getRibbonControllerInstance();
    dataConverter = getDataConverterInstance();

    configureEventMediator();

    ItemValueProvider.value = dataProvider.getValue;
    ItemValueProvider.setScale(scaleY);

    fisheye = FisheyeComponent.circular().radius(200).distortion(5);

    // save container that called the hierarchies
    svgContainer = selection;

    // initialize scales for positioning and length calculations
    scaleX.range([margin.left, width - margin.right]);
    scaleY.range([0, height - margin.top - margin.bottom - dimensionHeaderPadding]);

    dataProvider.getData().then((result) => {
      ({ itemList } = result);
      // FIXME: rename schema timestamps to aggregateDimensions
      aggregateDimensions = result.schema.timestamps;

      ItemValueProvider.primaryAggregateDimension = aggregateDimensions[0];
      ItemValueProvider.secondaryAggregateDimension = aggregateDimensions[0];

      itemList.forEach((item) => { item.active = true; });

      // use list of dimension names as default color domain and defaultColors for its range
      if (color.domain().length === 0) color.domain(result.schema.dimensions);
      if (color.range().length === 0) color.range(defaultColors);

      // dimensionsdata is an empty object at this point. It is populated by dataconverter and then
      // passed to dimensionController
      dataConverter
        .itemList(itemList)
        .dimensionsData(dimensionsData)
        .color(color)
        .createDimensions(result.schema);

      dimensionController
        .dimensionsData(dimensionsData)
        .itemList(itemList);

      ribbonController.itemList(itemList);

      // generate the hierarchy between categories
      dataConverter.buildHierarchy();

      initialDraw();
    });
  };

  let getDimensionControllerInstance = function() {
    return new DimensionController()
      .hierarchies(hierarchies)
      .scaleX(scaleX)
      .scaleY(scaleY)
      .margin(margin)
      .height(height)
      .itemID(itemID)
      .dimensionHeaderPadding(dimensionHeaderPadding);
  };

  let getRibbonControllerInstance = function() {
    return new RibbonController()
      .hierarchies(hierarchies)
      .itemID(itemID)
      .scaleY(scaleY);
  };

  let getDataConverterInstance = function() {
    return new DataConverter()
      .dataProvider(dataProvider)
      .initialDimensions(initialDimensions)
      .hierarchies(hierarchies);
  };

  let configureEventMediator = function() {
    EventMediator
      .hierarchiesComponent(hierarchies)
      .dimensionController(dimensionController)
      .ribbonController(ribbonController)
      .uiController(ui);
  };

  /**
   * Draws all SVG components. Starts by drawing dimensions, which then draw categories. Then adds
   * ribbons.
   * @return  {void}
   */
  let initialDraw = function() {
    svgContainer.selectAll('.parallelHierarchies').remove();
    root = svgContainer.append('g').attr('class', 'parallelHierarchies');

    svgContainer
      .on('mousemove', function() {

        if (useCategoryFisheye) {
          const focusPoint = d3.mouse(this);
          focusPoint[1] -= dimensionHeaderPadding;
          fisheye.focus(focusPoint);

          dimensionController.fisheye(fisheye);
          ribbonController.fisheye(fisheye);
        }
      });
    // add ribbons' <g> before dimensions' so that dimensions are drawn ontop of ribbons but ribbons
    // can still use the data for dimensions and categories
    ribbons = root.append('g')
      .attr('class', 'ribbons')
      .attr('transform', `translate(0, ${dimensionHeaderPadding})`);

    dimensions = root.append('g').attr('class', 'dimensions');

    dimensionController
      .root(dimensions)
      .init();

    ribbonController
      .root(ribbons)
      .init();
  };

  /**
   * Updates the domain of the vertical scale, so that the height of displayed categories fits into
   * the available height given to the application.
   * @return {void}
   */
  hierarchies.updateVerticalScaleDomain = function() {
    const valueSum = ItemValueProvider.getActiveItemValueSumForAllAggregates(itemList);
    scaleY.domain([0, valueSum]);
  };

  hierarchies.getListOfAllItems = function() {
    return itemList;
  };

  hierarchies.getActiveQueries = function(tree) {
    return utilityModule.getPathsInTree(tree);
  };

  hierarchies.cropText = function(text, num) {
    return utilityModule.cropText(text, num);
  };

  hierarchies.getCategories = function(dimension, query) {
    return dataConverter.getCategories(dimension, query);
  };

  hierarchies.optimizeIntersections = function() {
    ribbonController.optimizeIntersections();
  };

  hierarchies.getObservedDimensions = function() {
    return dimensionController.getObservedDimensions();
  };


  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

  hierarchies.dataProvider = function(_) {
    if (!arguments.length) return dataProvider;
    if (typeof _ === 'object') dataProvider = _;
    else throw Error('parallelHierarchies: dataProvider must be an object');
    return hierarchies;
  };

  hierarchies.ui = function(_) {
    if (!arguments.length) return ui;
    if (typeof _ === 'function') ui = _;
    else throw Error('parallelHierarchies: ui must be of type function');
    return hierarchies;
  };

  hierarchies.initialDimensions = function(_) {
    if (!arguments.length) return initialDimensions;
    if (typeof _ === 'object') initialDimensions = _;
    else throw Error('parallelHierarchies: initialDimensions must be an object');
    return hierarchies;
  };

  hierarchies.width = function(_) {
    if (!arguments.length) return width;
    if (typeof _ === 'number') width = _;
    else throw Error('parallelHierarchies: width must be a number');
    scaleX.range([margin.left, width - margin.right]);
    return hierarchies;
  };

  hierarchies.height = function(_) {
    if (!arguments.length) return height;
    if (typeof _ === 'number') height = _;
    else throw Error('parallelHierarchies: height must be a number');
    scaleY.range([0, height - margin.top - margin.bottom - dimensionHeaderPadding]);
    ItemValueProvider.setScale(scaleY);
    return hierarchies;
  };

  hierarchies.aggregateDimensions = function(_) {
    if (!arguments.length) return aggregateDimensions;
    if (typeof _ === 'object' && _.length <= 2) aggregateDimensions = _;
    else throw Error('parallelHierarchies: aggregateDimensions must be an object');
    return hierarchies;
  };

  hierarchies.secondaryAggregateDimension = function(_) {
    if (!arguments.length) return ItemValueProvider.secondaryAggregateDimension;
    if (typeof _ === 'string') ItemValueProvider.secondaryAggregateDimension = _;
    else throw Error('parallelHierarchies: secondaryAggregateDimension must be a string');
    hierarchies.updateVerticalScaleDomain();
    return hierarchies;
  };

  hierarchies.color = function(_) {
    if (!arguments.length) return color;
    if (typeof _ === 'function') color = _;
    else throw Error('parallelHierarchies: color must be of type function');
    return hierarchies;
  };

  hierarchies.useCategoryDragging = function(_) {
    if (!arguments.length) return useCategoryDragging;
    if (typeof _ === 'boolean') useCategoryDragging = _;
    else throw Error('parallelHierarchies: useCategoryDragging must be of type boolean');
    return hierarchies;
  };

  hierarchies.useCategoryFisheye = function(_) {
    if (!arguments.length) return useCategoryFisheye;
    if (typeof _ === 'boolean') useCategoryFisheye = _;
    else throw Error('parallelHierarchies: useCategoryFisheye must be of type boolean');
    return hierarchies;
  };

  hierarchies.useIntersectionMinimization = function(_) {
    if (!arguments.length) return useIntersectionMinimization;
    if (typeof _ === 'boolean') {
      useIntersectionMinimization = _;
      EventMediator.notify('intersectionMinimizationModeChanged');
    } else {
      throw Error('parallelHierarchies: useIntersectionMinimization must be of type boolean');
    }
    return hierarchies;
  };

  hierarchies.useGreedyOptimization = function(_) {
    if (!arguments.length) return useGreedyOptimization;
    if (typeof _ === 'boolean') {
      useGreedyOptimization = _;
      EventMediator.notify('intersectionMinimizationModeChanged');
    } else {
      throw Error('parallelHierarchies: useIntersectionMinimization must be of type boolean');
    }
    return hierarchies;
  };

  return hierarchies;
}
