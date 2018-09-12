import * as d3 from 'd3';

import ValueProvider from '../itemValueProvider';

const CategoryGenerator = function() {

  let data; // category this element is bound to

  let dimension; // reference to containing dimension
  let hierarchies;

  // D3 SELECTIONS
  let root; // root selection (=dimension) the category is attached to
  let group; // <g> grouping all contents of a category
  let box; // <rect> representing the category
  let categoryLabel; // <g> with label next to category
  let ancestorLabel; // <g> with label on top of category if isDrilledDown

  // SVG CONFIGURATION
  let width = 10; // width of category --> data independent, optional
  let height = -1; // height of category --> data dependent, MUST be set by calling dimension

  let x = -1;
  let y = -1;

  let isDrilledDown = false;
  let isDrawn = false;

  const fontSize = 12; // font size of label text
  const labelOffset = 20; // space between category block and label text
  const labelWidth = 100; // maximum width of label

  const easing = d3.easePolyOut;

  const hierarchyIndicatorPadding = 20; // top padding of hierarchyIndicator to border of box


  const category = function(selection) {
    if (data == null) throw Error('category: data must be set');

    root = selection;
    group = root.append('g')
      .attr('class', 'group')
      .attr('transform', 'translate(0, 0)');

    draw();

    category.update();
    isDrawn = true;
  };

  let draw = function() {
    appendBlocks();
    appendLabels();
    appendExpandIndicators();
  };

  /**
   * Updating a category whenever the containing dimension changed. Moves the label to the
   * @return {void}
   */
  category.update = function(useSmoothTransitions = true) {

    height = data.node.h;
    ({ y } = data.node);

    updateBlocks(useSmoothTransitions);
    updateLabels(useSmoothTransitions);
    updateExpandIndicators();
  };

  let updateBlocks = function(useSmoothTransitions = true) {
    const duration = useSmoothTransitions ? 400 : 0;
    const myHeight = getHeight();
    const myY = getY();
    const myFillColor = dimension.getColor(data.query);

    group.classed('inactive', data.activeAggregateValue === 0);
    group.selectAll('rect').data(['left', 'right']);
    box.selectAll('rect')
      .classed('hidden', isHidden)
      .transition()
      .duration(duration)
      .ease(easing)
      .style('fill', myFillColor)
      .attr('height', myHeight)
      .attr('width', width)
      .attr('transform', d => `translate(${d === 'left' ? -x : x},0)`);

    group.transition()
      .duration(duration)
      .ease(easing)
      .attr('transform', `translate(0,${myY})`);
  };

  let getHeight = function() {
    if (height === 0) return 0;

    const avgUncHgt = ValueProvider.getUncertaintyHeightForItemList(Object.values(data.items));

    if (avgUncHgt !== null && !isDrilledDown) {
      return height - (avgUncHgt / 2);
    }

    return height;
  };

  let getY = function() {
    if (height === 0) return 0;
    const avgUncHgt = ValueProvider.getUncertaintyHeightForItemList(Object.values(data.items));

    if (avgUncHgt !== null && !isDrilledDown) {
      return y + (avgUncHgt / 4);
    }

    return y;
  };

  const getAncestorFontColor = function() {
    if (height === 0) return 0;
    const avgUncHgt = ValueProvider.getUncertaintyHeightForItemList(Object.values(data.items));

    if (avgUncHgt !== null) {
      return '#fff';
    }

    return null;
  };

  const updateLabels = function(useSmoothTransitions = true) {
    const shiftX = dimension.isLast()
      ? (-(data.query.length + 1) * (dimension.ancestorPadding() + width)) - labelWidth
      : ((data.query.length + 1) * (dimension.ancestorPadding() + width));

    const duration = useSmoothTransitions ? 400 : 0;

    // animate position change of category label (background and text positioning)
    categoryLabel
      .classed('hidden', height < fontSize || isDrilledDown || data.activeAggregateValue === 0)
      .transition().duration(duration)
      .attr('transform', `translate(${shiftX},0)`);

    categoryLabel.select('text.label')
      .attr('dx', dimension.isLast() ? labelWidth - 10 : 10)
      .attr('text-anchor', dimension.isLast() ? 'end' : 'start');

    ancestorLabel.transition().duration(duration)
      .attr('transform', d => `translate(${d === 'left' ? -x : x},0)`);

    ancestorLabel.selectAll('text.label')
      .classed('hidden', d => !isDrilledDown || isHidden(d))
      .transition().duration(duration)
      .attr('fill', getAncestorFontColor())
      .attr('font-size', width)
      .attr('transform', `translate(0,${height / 2})rotate(-90)translate(0,${(width * 4) / 5})`)
      .text(hierarchies.cropText(data.label, height));
  };

  let updateExpandIndicators = function() {

    const indicatorSize = 22;
    const hideIndicator = isDrilledDown || height < (indicatorSize);

    group.selectAll('text.hierarchyIndicator')
      .classed('hidden', d => hideIndicator || isHidden(d) || data.activeAggregateValue === 0)
      .attr('x', width / 2)
      .attr('transform', d => `translate(${d === 'left' ? -x : x},0)`);
  };

  /**
   * Apply a fisheye transformation to this category given a fisheye transformation.
   * @param   {object}  fisheye the fisheye transformation
   * @return  {void}
   */
  category.fisheye = function(transformation) {
    if (transformation === null) {
      ({ y } = data.node);
      group.attr('transform', `translate(0,${y})`);
      categoryLabel.classed('hidden', height < fontSize || isDrilledDown);
      return;
    }

    const position = { x: dimension.x() + x, y: data.node.y };
    const transformedPosition = transformation(position);
    ({ y } = transformedPosition);

    group.attr('transform', `translate(0,${y})`);
    categoryLabel.classed('hidden', isDrilledDown);
  };

  /**
   * Check if this category is to be highlighted provided a list of highlighted items. Sets the
   * 'highlight' class of the <g> accordingly. Is called on mouseover for every active category.
   * @param   {object}  items dictionary of items in the mouse-overed category
   * @return  {void}
   */
  category.highlight = function(items) {
    if (height === 0) return;
    let highlightMe = false;

    const keys = Object.keys(data.items);
    for (let i = 0, len = keys.length; i < len && !highlightMe; i++) {
      highlightMe = items[keys[i]] != null;
    }

    if (highlightMe) {
      box.selectAll('rect').attr('fill', d3.rgb(dimension.data().color).darker(1));
    } else {
      box.selectAll('rect').attr('fill', dimension.data().color);
    }
  };

  /**
   * The block is the <rect> that indicates the part-of-whole relationship of a category to other
   * categories on the same dimension. The bigger the category vertically, the more elements in the
   * dataset share this category. If a category can be expanded (has child categories), a '+' is
   * drawn above the block.
   * @return  {void}
   */
  let appendBlocks = function() {
    if (height < 0) throw Error('category: height must be set and at bigger than 0');

    group.select('.box').remove();

    box = group.append('g').attr('class', 'box');

    box.selectAll('rect').data(['left', 'right']).enter()
      .append('rect')
      .attr('class', d => d)
      .classed('hidden', isHidden)
      .attr('height', height)
      .attr('width', width)
      .attr('fill', dimension.data().color)
      .attr('transform', d => `translate(${d === 'left' ? -x : x},0)`);
  };

  /**
   * '+' signs on top of category indicating that it's hierarchy can be drilled further down.
   * @return {void}
   */
  let appendExpandIndicators = function() {
    // add the indicator that the category can be expanded
    if (data.expandable) {
      group.selectAll('text.hierarchyIndicator').data(['left', 'right']).enter()
        .append('text')
        .attr('class', 'hierarchyIndicator')
        .attr('text-anchor', 'middle')
        .attr('y', hierarchyIndicatorPadding)
        .attr('x', width / 2)
        .text('+');
    }
  };

  /**
   * Adds all labels (next to and on top of category).
   * @return {void}
   */
  let appendLabels = function() {
    appendCategoryLabel();
    appendAncestorLabel();
  };

  /**
   * The label for a category consists of a background <rect> and a <text>-element on top which
   * displays the label property of this category.
   * @return  {void}
   */
  let appendCategoryLabel = function() {
    // calculates the horizontal offset to the center of the dimension depending on the length of
    // the current query, since every term is represented by a vertical line with a fixed width
    const shiftX = dimension.isLast()
      ? (-data.query.length * (width + 2)) - labelOffset - labelWidth
      : (data.query.length * (width + 2)) + labelOffset;

    categoryLabel = group.append('g')
      .attr('class', 'category_label')
      .attr('transform', `translate(${x + shiftX},0)`);

    // background of label
    categoryLabel.append('rect')
      .attr('class', 'background')
      .attr('height', fontSize + 5)
      .attr('width', labelWidth);

    // the label of the dimension, specified in the schema and added as .label property to the data
    // by the calling dimension
    categoryLabel.append('text')
      .attr('class', 'label')
      .attr('font-size', fontSize)
      .attr('dx', dimension.isLast() ? labelWidth - 10 : 10)
      .attr('dy', fontSize + 1)
      .attr('text-anchor', dimension.isLast() ? 'end' : 'start')
      .text(hierarchies.cropText(data.label, labelWidth - 10));

    categoryLabel.classed('hidden', height < fontSize || isDrilledDown);
  };

  /**
   * Adds a label on top of the category, which is used whenever the category is an ancestor inside
   * an active query
   * @return {void}
   */
  let appendAncestorLabel = function() {
    // group moves both left and right label to the labelled ancestor
    ancestorLabel = group.selectAll('g.ancestor_label').data(['left', 'right']).enter()
      .append('g')
      .attr('class', 'ancestor_label')
      .attr('transform', (text) => {
        if (text === 'left') return `translate(${-x},0)`;
        return `translate(${x},0)`;
      });

    // rotate and shift text so they cover the ancestor's rect
    ancestorLabel.append('text')
      .attr('class', 'label')
      .attr('text-anchor', 'middle')
      .classed('hidden', isHidden)
      .attr('font-size', width)
      .attr('transform', `translate(0,${height / 2})rotate(-90)translate(0,${(width * 4) / 5})`)
      .text(hierarchies.cropText(data.label, height));
  };

  /**
   * Checks if a datum should be shown or not, depending on the horizontal position of the dimension
   * and whether the datum says 'left' or 'right'.
   * @param   {string}  positionLabel element of ['left', 'right']
   * @return  {boolean}               whether or not the datum should be hidden
   */
  let isHidden = function(positionLabel) {
    const leftHidden = positionLabel === 'left' && dimension.isFirst();
    const rightHidden = positionLabel === 'right' && dimension.isLast();
    return leftHidden || rightHidden;
  };

  category.isDrawn = function() { return isDrawn; };


  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

  category.data = function(_) {
    if (!arguments.length) return data;
    if (typeof _ === 'object') data = _;
    else throw Error('category: data must be of type object');
    return category;
  };

  category.dimension = function(_) {
    if (!arguments.length) return dimension;
    if (typeof _ === 'function') dimension = _;
    else throw Error('category: dimension must be of type function');
    return category;
  };

  category.hierarchies = function(_) {
    if (!arguments.length) return hierarchies;
    if (typeof _ === 'function') hierarchies = _;
    else throw Error('category: hierarchies must be of type function');
    return category;
  };

  category.isDrilledDown = function(_) {
    if (!arguments.length) return isDrilledDown;
    if (typeof _ === 'boolean') isDrilledDown = _;
    else throw Error('category: isDrilledDown must be of type boolean');
    return category;
  };

  category.width = function(_) {
    if (!arguments.length) return width;
    if (typeof _ === 'number') width = _;
    else throw Error('category: width must be of type number');
    return category;
  };

  category.height = function(_) {
    if (!arguments.length) return height;
    if (typeof _ === 'number') height = _;
    else throw Error('category: height must be of type number');
    return category;
  };

  category.x = function(_) {
    if (!arguments.length) return x;
    if (typeof _ === 'number') x = _;
    else throw Error('category: x must be of type number');
    return category;
  };

  category.y = function(_) {
    if (!arguments.length) return y;
    if (typeof _ === 'number') y = _;
    else throw Error('category: y must be of type number');
    return category;
  };

  return category;
};

export default CategoryGenerator;
