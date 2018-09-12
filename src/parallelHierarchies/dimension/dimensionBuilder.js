import * as d3 from 'd3';

import CategoryGenerator from './category';
import EventMediator from '../eventMediator';

const DimensionBuilder = function() {
  const builder = {};

  let dimension;

  let hierarchy;
  const observedCategories = []; // list of categories waiting for changes

  // D3 SELECTIONS
  let root;
  let header; // <g> header of a dimension
  let dimensionRoot; // <g> of ancestor-categories
  let dropdown;
  let selected;

  // SVG CONFIGURATION
  let height = -1; // maximum vertical space for dimension, MUST be set
  let categoryWidth = 12; // width of dimension rect
  let headerPadding = 120; // space between header and categories
  let ancestorPadding = 4; // horizontal padding between hierarchy levels

  // let defaultAncestorPadding;
  // let defaultCategoryWidth;

  /**
   * Adds the category hierarchy to the DOM.
   * @param  {object} root  DOM node the hierarchy is drawn into
   * @return {void}
   */
  builder.drawHierarchy = function() {
    root.select('.dimensionRoot').remove();

    dimensionRoot = root.append('g')
      .attr('class', 'dimensionRoot clickable')
      .attr('transform', `translate(${-categoryWidth / 2}, ${headerPadding})`);

    // defaultAncestorPadding = ancestorPadding;
    // defaultCategoryWidth = categoryWidth;

    observedCategories.length = 0;

    builder.updateHierarchy();
  };

  /**
   * Updates visual representations for all category generators.
   * @return {void}
   */
  builder.updateHierarchy = function(useAnimatedUpdate = true) {
    // add a generator only for active nodes of the hierarchy (i.e. height > 0). This 'syncs' the
    // observedCategories array between instances of the same dimension object
    hierarchy.each((node) => {
      if (node === hierarchy) return;
      if (node.h === 0) return;
      getCategoryGenerator(node);
    });

    // adds a <g> for all observed categories without a visual representation
    dimensionRoot.selectAll('g.category').data(observedCategories, d => d.data().descriptor).enter()
      .append('g')
      .attr('class', 'category')
      .on('click', onCategoryClicked)
      .on('mouseenter', onCategoryMouseEnter)
      .on('mousemove', onCategoryMouseMove)
      .on('mouseleave', onCategoryMouseLeave)
      .call(drag);

    dimensionRoot.selectAll('g.category').data(observedCategories, d => d.data().descriptor).exit()
      .remove();

    // draws all categories that have not yet beeen drawn
    dimensionRoot.selectAll('g.category')
      .filter(cat => !cat.isDrawn())
      .each(function(cat) {
        d3.select(this).call(cat);
      });

    observedCategories.forEach((generator) => {
      generator
        .x(generator.data().query.length * (getCategoryWidthForQueryDepth() + ancestorPadding))
        .width(getCategoryWidthForQueryDepth())
        .isDrilledDown(generator.data().isDrilledDown)
        .update(useAnimatedUpdate);
    });
  };

  /**
   * Creates the header box for the dimension
   * @return  {void}
   */
  builder.drawDimensionHeader = function() {
    root.select('.header').remove();

    header = root.append('g')
      .attr('class', 'header')
      .attr('transform', 'translate(0, 20)');

    appendTitle();

    appendOrderDropdown();
  };

  /**
   * Given a node from a hierarchy, this will either create a new category generator or return an
   * existing one.
   * @param   {object}    node element of hierarchy
   * @return  {function}       category generator for the node
   */
  let getCategoryGenerator = function(node) {
    const existingGenerator = observedCategories.find(generator => generator.data().node === node);
    if (existingGenerator !== undefined) return existingGenerator;

    const newGenerator = createCategoryGenerator(node);
    observedCategories.push(newGenerator);
    return newGenerator;
  };

  /**
   * Given a node from the hierarchy, this will create the category generator which represents this
   * node visually.
   * @param   {object}    node  node from the hierarchy
   * @return  {function}        category generator
   */
  let createCategoryGenerator = function(node) {
    const cat = new CategoryGenerator()
      .data(node.data.value)
      .height(node.h)
      .width(getCategoryWidthForQueryDepth())
      .x(node.data.value.query.length * (getCategoryWidthForQueryDepth() + ancestorPadding))
      .y(node.y)
      .hierarchies(dimension.hierarchies())
      .dimension(dimension);

    return cat;
  };

  /**
   * Based on the depth of the visible hierarchy return a width for categories.
   * @return {number} width for categories
   */
  let getCategoryWidthForQueryDepth = function() {
    const DEPTH_WITH_FIXED_WIDTH = 5;
    const listOfQueryLengths = observedCategories
      .filter(d => d.data().node.h > 0)
      .map(d => d.data().query.length);

    const longestQueryLength = (d3.max(listOfQueryLengths) || 0);

    if (longestQueryLength < DEPTH_WITH_FIXED_WIDTH) return categoryWidth;

    return (categoryWidth * DEPTH_WITH_FIXED_WIDTH) / longestQueryLength;
  };

  let appendTitle = function() {
    // draw name of dimension
    const title = header.append('text')
      .attr('class', 'title');

    title.append('tspan')
      .style('fill', dimension.data().color)
      .text(`${dimension.data().name}`);

    title.append('tspan')
      .attr('class', 'remove')
      .attr('dx', 10)
      .attr('dy', -2)
      .text('✖')
      .on('click', () => {
        EventMediator.notify('dimensionRemoved', { 'dimension': dimension });
      });
  };

  let appendOrderDropdown = function() {
    const opts = ['Value ▼', 'Description ▼', 'Minimized Intersections'];
    const optionSize = 20;

    selected = header.append('text')
      .attr('class', 'selected clickable')
      .attr('dy', optionSize)
      .text(dimension.data().numerical ? opts[1] : opts[opts.length - 1])
      .on('click', () => {
        dropdown.classed('hidden', !dropdown.classed('hidden'));
      });

    dropdown = header.append('g')
      .attr('class', 'dropdown hidden')
      .attr('transform', `translate(0,${optionSize * 3})`);

    dropdown.append('rect')
      .attr('class', 'background')
      .attr('width', 200)
      .attr('x', -100)
      .attr('y', -optionSize * 1)
      .attr('height', (opts.length + 0.5) * 20)
      .attr('fill', '#ccc')
      .attr('fill-opacity', 0.73);

    dropdown.append('g').attr('class', 'options').selectAll('text.option').data(opts)
      .enter()
      .append('text')
      .attr('class', 'option clickable')
      .classed('active', (d, i) => (i === 2 && !dimension.data().numerical) || (i === 1 && dimension.data().numerical))
      .attr('y', (d, i) => i * 20)
      .text(d => d)
      .on('click', onOrderClicked);
  };

  let onOrderClicked = function(d, i) {
    // depending on which option was selected, sort the categories by value, description or
    // according to the minimized layout
    if (i === 0) {
      dimension.sortHierarchyByValue();
      d3.select(this).text(dimension.isSortedByValue() ? 'Value ▼' : 'Value ▲');
    } else if (i === 1) {
      dimension.sortHierarchyByDescription();
      d3.select(this).text(dimension.isSortedByDescription() ? 'Description ▼' : 'Description ▲');
    } else if (i === 2) {
      dimension.sortByOrdering();
      d3.select(this).text('Minimized Intersections');
    }

    // mark the option active that was clicked on (and inactive for any other option)
    dropdown.selectAll('text.option').classed('active', false);
    d3.select(this).classed('active', true);

    // change the text beneath the title that stores the same value as the clicked on option
    selected.text(d3.select(this).text());

    // let hierarchies know about changes to update ribbons as well
    EventMediator.notify('categoryPositionChanged', { 'category': null });

    dropdown.classed('hidden', !dropdown.classed('hidden'));
  };

  const drillDownCategory = function(cat) {
    const categoryData = cat.data();

    // leaf nodes cannot be added to the query
    if (Object.keys(categoryData.children).length === 0) {
      EventMediator.notify('warning', 'Clicked category has no child categories');
      return;
    }

    if (!categoryData.expandable) {
      EventMediator.notify('warning', 'Clicked category has no child categories');
      return;
    }

    if (!dimension.itemsPassivelyPresentInAllOtherActiveDimensions(categoryData.items)) {
      EventMediator.notify('warning', 'Clicked category is filtered out by queries on other dimensions');
      return;
    }

    // add generators for all child nodes, if they are not present yet
    cat.data().node.children.forEach(getCategoryGenerator);

    // traverse the query tree for this dimension along the query for the clicked on dimension
    // to add its term to the query tree.
    const categoryQuery = categoryData.query;
    dimension.data().queryList = categoryData.query.concat(categoryData.identifier);
    dimension.data().queryTree = {};
    let queryNode = dimension.data().queryTree;
    for (let t = 0; t < categoryQuery.length; t++) {
      if (queryNode[categoryQuery[t]] == null) queryNode[categoryQuery[t]] = {};
      queryNode = queryNode[categoryQuery[t]];
    }

    // add the category's identifier to the query of this dimension
    queryNode[categoryData.identifier] = {};

    // update dimensions and ribbons based on the new query
    EventMediator.notify('categoryClicked', { 'category': categoryData });
  };

  const rollUpCategory = function(cat) {
    // remove the term at the level of this ancestor (including all terms on deeper levels)
    // and update the dimension afterwards
    const categoryData = cat.data();
    let node = dimension.data().queryTree;
    dimension.data().queryList = categoryData.query;
    for (let t = 0; t < categoryData.query.length; t++) {
      node = node[categoryData.query[t]];
    }

    // remove this node's term from the query
    delete node[categoryData.identifier];

    // update all instances of this dimension to display the new query
    EventMediator.notify('categoryClicked', { 'category': categoryData });
  };

  let onCategoryClicked = function(categoryGenerator) {
    if (categoryGenerator.isDrilledDown()) {
      rollUpCategory(categoryGenerator);
    } else {
      drillDownCategory(categoryGenerator);
    }
  };

  let onCategoryMouseEnter = function(categoryGenerator) {
    EventMediator.notify('categoryMouseEnter', { 'category': categoryGenerator, 'event': d3.event });
  };

  let onCategoryMouseMove = function(categoryGenerator) {
    EventMediator.notify('categoryMouseMove', { 'category': categoryGenerator, 'event': d3.event });
  };

  let onCategoryMouseLeave = function(categoryGenerator) {
    EventMediator.notify('categoryMouseOut', { 'category': categoryGenerator, 'event': d3.event });
  };

  const onCategoryDragStart = function(cat) {
    if (!cat.data().isQueryLeaf) return;
    EventMediator.notify('categoryDraggingStarted');
    cat.mouseYOffsetOnStart = d3.mouse(d3.select(this).select('rect').node())[1];
    d3.select(this).classed('dragging', true);
  };

  const onCategoryDrag = function(cat) {
    if (!cat.data().isQueryLeaf) return;
    const mousePositionY = d3.mouse(root.node())[1] - headerPadding - cat.mouseYOffsetOnStart;

    const siblingNodes = cat.data().siblings;
    const siblingGenerators = observedCategories
      .filter(generator => siblingNodes.indexOf(generator.data()) > -1);

    const neighborhood = siblingGenerators.concat(cat);

    neighborhood.sort((a, b) => a.y() - b.y());

    const indexBeforeDrag = neighborhood.indexOf(cat);

    cat.y(mousePositionY);
    cat.data().node.y = mousePositionY;

    neighborhood.sort((a, b) => {
      if (a.y() <= b.y()) return -1;

      return 1;
    });

    const indexAfterDrag = neighborhood.indexOf(cat);

    if (indexBeforeDrag !== indexAfterDrag) {
      dimension.sortHierarchyByYPosition();
      siblingGenerators.forEach(generator => generator.update(true));
    }

    cat.y(mousePositionY);
    cat.data().node.y = mousePositionY;

    EventMediator.notify('categoryPositionChanged', {
      'category': cat,
    });

    cat.update(false);
  };

  const onCategoryDragEnd = function(cat) {
    if (!cat.data().isQueryLeaf) return;
    d3.select(this).classed('dragging', false);

    dimension.sortHierarchyByYPosition();
    cat.update(true);

    EventMediator.notify('categoryPositionChanged', { 'category': null });
    EventMediator.notify('categoryDraggingEnded');
  };

  // const onDimensionZoomed = function() {
  //   ancestorPadding = defaultAncestorPadding * d3.event.transform.k;
  //   categoryWidth = defaultCategoryWidth * d3.event.transform.k;
  //   dimensionRoot.attr('transform', `translate(${-categoryWidth / 2}, ${headerPadding})`);
  //   builder.updateHierarchy(false);
  //   EventMediator.notify('categoryPositionChanged', { 'category': null });
  // };

  builder.getObservedCategories = function() {
    return observedCategories;
  };

  /**
   * Apply fisheye effect to all visible categories
   * @param   {object}  fisheye tranformation including focuspoint and radius
   * @return  {void}
   */
  builder.fisheye = function(transformation) {
    observedCategories
      .filter(generator => generator.height() > 0)
      .forEach((generator) => {
        generator.fisheye(transformation);
      });
  };

  const drag = d3.drag()
    .on('start', onCategoryDragStart)
    .on('drag', onCategoryDrag)
    .on('end', onCategoryDragEnd);

  builder.setDimensionHeaderSortingText = function(text) {
    header.select('text.selected').text(text);
  };

  // const zoom = d3.zoom()
  //   .scaleExtent([1, 10])
  //   .on('zoom', onDimensionZoomed);

  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

  builder.dimension = function(_) {
    if (!arguments.length) return dimension;
    if (typeof _ === 'function') dimension = _;
    else throw Error('builder: dimension must be of type function');
    return builder;
  };

  builder.hierarchy = function(_) {
    if (!arguments.length) return hierarchy;
    if (typeof _ === 'object') hierarchy = _;
    else throw Error('builder: hierarchy must be of type object');
    return builder;
  };

  builder.root = function(_) {
    if (!arguments.length) return root;
    if (typeof _ === 'object') root = _;
    else throw Error('builder: root must be of type object');
    return builder;
  };

  builder.height = function(_) {
    if (!arguments.length) return height;
    if (typeof _ === 'number') height = _;
    else throw Error('builder: height must be of type number');
    return builder;
  };

  builder.ancestorPadding = function(_) {
    if (!arguments.length) return ancestorPadding;
    if (typeof _ === 'number') ancestorPadding = _;
    else throw Error('builder: ancestorPadding must be of type number');
    return builder;
  };

  builder.headerPadding = function(_) {
    if (!arguments.length) return headerPadding;
    if (typeof _ === 'number') headerPadding = _;
    else throw Error('builder: headerPadding must be of type number');
    return builder;
  };

  builder.categoryWidth = function(_) {
    if (!arguments.length) return categoryWidth;
    if (typeof _ === 'number') categoryWidth = _;
    else throw Error('builder: categoryWidth must be of type number');
    return builder;
  };

  return builder;
};

export default DimensionBuilder;