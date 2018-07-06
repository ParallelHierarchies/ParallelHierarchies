parallelHierarchies.category = function() {

  let data; // category this element is bound to

  let dimension; // reference to containing dimension

  // D3 SELECTIONS
  let root; // root selection (=dimension) the category is attached to
  let box; // <rect> representing the category
  let label; // <g> containing the label components for the category

  // SVG CONFIGURATION
  let width = 10; // width of category --> data independent, optional
  let height = -1; // height of category --> data dependent, MUST be set by calling dimension
  let x = -1;
  let y = -1;

  let fontSize = 12; // font size of label text
  let labelOffset = 20; // space between category block and label text
  let labelWidth = 100; // maximum width of label


  let category = function(selection) {
    if (data == null) throw Error('category: data must be set');
    root = selection;

    draw();
  };

  let draw = function() {
    if (data.timestamps.length === 2) drawTimestamps();
    else drawBlock();
    drawLabel();
    drawExpandIndicator();
  };

  /**
   * Updating a category whenever the containing dimension changed. Moves the label to the
   * @return {void}
   */
  category.update = function() {
    let shiftX = dimension.isLast()
    ? -data.dimension.query.length * (width + 4) - labelOffset - labelWidth
    : data.dimension.query.length * (width + 4) + labelOffset;

    let duration = 300;

    // animate position change of category label (background and text positioning)
    label.transition().duration(duration)
      .attr('transform', 'translate('+shiftX+',0)');

    label.select('text').transition().duration(duration)
      .attr('dx', dimension.isLast() ? labelWidth - 10 : 10)
      .attr('text-anchor', dimension.isLast() ? 'end' : 'start');

    // show/hide left and right box if the containing dimension is on the very left or right
    box.selectAll('.left').classed('hidden', dimension.isFirst());
    box.selectAll('.right').classed('hidden', dimension.isLast());
  };

  /**
   * Apply a fisheye transformation to this category given a fisheye object.
   * @param   {object}  fisheye the fisheye configuration
   * @return  {void}
   */
  category.fisheye = function(fisheye) {
    label.classed('hidden', fisheye != null ? false : height < fontSize);
    category.fy = fisheye != null ? fisheye.y : null;
  };

  /**
   * Check if this category is to be highlighted provided a list of highlighted items. Sets the
   * 'highlight' class of the <g> accordingly. Is called on mouseover for every active category.
   * @param   {object}  items dictionary of items in the mouse-overed category
   * @return  {void}
   */
  category.highlight = function(items) {
    let highlightMe = false;

    if (items == null) items = {};
    let keys = Object.keys(items);
    for (let i = 0, len = keys.length; i < len && !highlightMe; i++) {
      if (items[keys[i]].active)
        highlightMe = data.items[keys[i]] != null;
    }

    box.selectAll('rect').attr('fill', highlightMe ? d3.rgb(data.dimension.color).darker(1) : data.dimension.color)
    return highlightMe ? data.label : null;
  };

  /**
   * The block is the <rect> that indicates the part-of-whole relationship of a category to other
   * categories on the same dimension. The bigger the category vertically, the more elements in the
   * dataset share this category. If a category can be expanded (has child categories), a '+' is
   * drawn above the block.
   * @return  {void}
   */
  let drawBlock = function() {
    if (height < 0) throw Error('category: height must be set and at bigger than 0');

    root.select('.box').remove();
    let offsetX = data.dimension.query.length * (width + 4);

    box = root.append('g').attr('class', 'box');

    box.append('rect')
      .attr('class', 'left')
      .classed('hidden', dimension.isFirst())
      .attr('height', height)
      .attr('width', width)
      .attr('fill', data.dimension.color)
      .attr('transform', 'translate('+-offsetX+',0)');

    box.append('rect')
      .attr('class', 'right')
      .classed('hidden', dimension.isLast())
      .attr('height', height)
      .attr('width', width)
      .attr('fill', data.dimension.color)
      .attr('transform', 'translate('+offsetX+',0)');
  };

  let drawTimestamps = function() {
    if (height < 0) throw Error('category: height must be set and at bigger than 0');

    root.select('.box').remove();

    let offsetX = data.dimension.query.length * (width + 4);

    box = root.append('g').attr('class', 'box');

    let diff = (Math.abs(data.timestamps[0] - data.timestamps[1]) / d3.max(data.timestamps)) * d3.sum(data.timestamps);

    box.append('rect')
      .attr('class', 'left max')
      .classed('hidden', dimension.isFirst())
      .attr('height', height)
      .attr('width', width)
      .attr('transform', 'translate('+-offsetX+',0)');

    box.append('rect')
      .attr('class', 'left diff')
      .classed('hidden', dimension.isFirst())
      .classed('increase', data.timestamps[0] < data.timestamps[1])
      .classed('decrease', data.timestamps[0] > data.timestamps[1])
      .attr('height', diff)
      .attr('width', width)
      .attr('transform', 'translate('+-offsetX+','+(d3.sum(data.timestamps)-diff)+')');

    box.append('rect')
      .attr('class', 'right max')
      .classed('hidden', dimension.isLast())
      .attr('height', height)
      .attr('width', width)
      .attr('transform', 'translate('+offsetX+',0)');

    box.append('rect')
      .attr('class', 'right diff')
      .classed('hidden', dimension.isLast())
      .classed('increase', data.timestamps[0] < data.timestamps[1])
      .classed('decrease', data.timestamps[0] > data.timestamps[1])
      .attr('height', diff)
      .attr('width', width)
      .attr('transform', 'translate('+offsetX+','+(d3.sum(data.timestamps)-diff)+')');
  }

  let drawExpandIndicator = function() {
    let offsetX = data.dimension.query.length * (width + 4);
    // add the indicator that the category can be expanded
    if (data.expandable) {
      if (!dimension.isFirst())
        root.append('text')
          .attr('class', 'hierarchyIndicator')
          .classed('hidden', height < fontSize)
          .attr('font-size', width * 2)
          .attr('text-anchor', 'middle')
          .attr('dx', width/2)
          .attr('dy', width*1.5)
          .text('+')
          .attr('transform', 'translate('+-offsetX+',0)');

      if (!dimension.isLast())
        root.append('text')
          .attr('class', 'hierarchyIndicator')
          .classed('hidden', height < fontSize)
          .attr('text-anchor', 'middle')
          .attr('font-size', width * 2)
          .attr('dx', width/2)
          .attr('dy', width*1.5)
          .text('+')
          .attr('transform', 'translate('+offsetX+',0)');
    }
  }

  /**
   * The label for a category consists of a background <rect> and a <text>-element on top which
   * displays the label property of this category.
   * @return  {void}
   */
  let drawLabel = function() {
    // calculates the horizontal offset to the center of the dimension depending on the length of
    // the current query, since every term is represented by a vertical line with a fixed width
    let shiftX = dimension.isLast()
    ? -data.dimension.query.length * (width + 4) - labelOffset - labelWidth + 10
    : data.dimension.query.length * (width + 4) + labelOffset;

    label = root.append('g')
      .attr('class', 'label')
      .attr('transform', 'translate('+shiftX+',0)');

    // background of label
    label.append('rect')
      .attr('class', 'background')
      .attr('height', fontSize + 5)
      .attr('width', labelWidth);

    // the label of the dimension, specified in the schema and added as .label property to the data
    // by the calling dimension
    label.append('text')
      .attr('font-size', fontSize)
      .attr('dx', dimension.isLast() ? labelWidth - 10 : 10)
      .attr('dy', fontSize + 1)
      .attr('text-anchor', dimension.isLast() ? 'end' : 'start')
      .text(cropText(data.label, labelWidth - 10));

    label.classed('hidden', height < fontSize);
  };

  /**
   * Returns a function that crops the given string to fit the given width in px.
   * @param   {string}  text  label content
   * @param   {number}  num   number of pixels the text may be long at most
   * @returns {function}      function that truncates the given text to the given length
   */
  let cropText = function(text, num) {
    return function(d, i) {
      let t = this.textContent = text;
      let w = num;

      if (this.getComputedTextLength() < w) return t;

      this.textContent = '…' + t;

      let lo = 0;
      let hi = t.length + 1;
      let x;
      while (lo < hi) {
        let mid = lo + hi >> 1;
        if ((x = this.getSubStringLength(0, mid)) < w) lo = mid + 1;
        else hi = mid;
      }
      return lo > 1 ? t.substr(0, lo - 2) + '…' : '';
    };
  };

  category.subscribe = function(observer) {
    return category.dimension(observer);
  };


  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

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

  category.labelBackgroundFillColor = function(_) {
    if (!arguments.length) return labelBackgroundFillColor;
    if (typeof _ === 'string') labelBackgroundFillColor = _;
    else throw Error('category: labelBackgroundFillColor must be of type string');
    return category;
  };

  return category;
}
