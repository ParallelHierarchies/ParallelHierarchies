parallelHierarchies.ui = function() {
  let root;

  let data;
  let hierarchies;
  let scaleY;

  // D3 CONFIGURATION
  let dropDownMenu;
  let tooltip;
  let timestampSliders;
  let swapDatasetButton;
  let title;
  let rulerLength = 1000;

  let ui = function(selection) {
    if (hierarchies == null) throw Error('ui: hierarchies must be set');
    if (tooltip == null) throw Error('ui: tooltip must be set');
    if (timestampSliders == null) throw Error('ui: timestampSliders must be set');

    root = selection;

    // FIXME: this will cause the schema to be loaded twice: find a better solution!
    hierarchies.dataProvider().loadData().then(function(res) {
      data = res;
      draw();
    });
  };

  let draw = function() {
    // if a titleSelection was set, set it's text to the value provided in schema
    if (title != null) title.text(data.schema.title);

    // get a list of properties in the items (=dimension names)
    let keys = dataProvider.getSchema().dimensions.filter(d => d !== 'RACE');

    dropDownMenu.selectAll('option').remove();
    for (let l = 0; l < keys.length; l++) {
      let label = keys[l];

      // do not list options for the item id and value properties
      dropDownMenu.append('option').text(label);
    }

    // add the clicked on dimension to the parallelhierarchies
    dropDownMenu.on('change', function() {
      hierarchies.notify('dimensionAdded', { 'name': this.value })
    });

    // add components to tooltip and hide it initially
    tooltip.append('p').attr('class', 'heading');
    tooltip.append('ul').attr('class', 'body');
    tooltip.classed('hidden', true);
  };

  /**
   * Adds a visual element respresenting a ruler which can be used to compare heights in the
   * parallHierarchies.
   */
  ui.addRuler = function() {
    let ruler = root.append('div').attr('class', 'ruler grabbable');

    // add horizontal line which cuts through the parallel Sets
    ruler.append('div')
      .attr('class', 'guideline')
      .style('width', rulerLength + 'px');

    // add a handle for interaction
    ruler.append('div')
      .attr('class', 'handle');

    // add a remove region to delete the ruler
    ruler.append('div')
      .attr('class', 'delete clickable')
      .on('click', function() { d3.select(this.parentNode).remove() });

    // handle follows cursor
    ruler.on('mousemove', function() {
      // restrict handle movement to length of ruler to not cover up the delete region
      d3.select(this).select('.handle')
        .style('left', Math.min(d3.event.x-30, rulerLength-50) + 'px');
    });

    // add drag behavior: dragging the ruler moves it vertically
    ruler.call(d3.drag()
      .on('start', function() { d3.select(this).classed('dragging', true) })
      .on('drag', function() {
        d3.select(this).style('transform', 'translateY('+d3.event.y+'px)')
      })
      .on('end', function() { d3.select(this).classed('dragging', false) }));
  };

  ui.hideTooltip = function() {
    tooltip.classed('hidden', true);
  };

  ui.moveTooltip = function(event) {
    tooltip.style('left', event.clientX + 'px').style('top', event.clientY + 'px');
  };

  ui.setCategoryInteraction = function(flag) {
    hierarchies.useCategoryFisheye(flag === 'fisheye');
    hierarchies.useCategoryDragging(flag === 'drag');
  };

  /**
   * Sets the text inside the tooltip to the given parameters.
   * @param   {string}  heading heading of tooltilp
   * @param   {object}  body    body of tooltip. Every property gets one entry in the tooltip
   * @param   {object}  event   d3.event on mouseover
   * @return  {void}
   */
  ui.showTooltip = function(heading, body, event) {
    tooltip.style('left', event.clientX + 'px').style('top', event.clientY + 'px');

    tooltip.select('p.heading').text(heading);
    tooltip.select('ul.body').selectAll('li').remove();

    // tooltip.select('p.body').text(body);
    if (typeof body === 'string') {
      tooltip.select('ul.body').append('li').text(body);
    } else if (typeof body === 'object') {
      let row;
      for (let property in body) {
        row = tooltip.select('ul.body').append('li');
        row.append('span').attr('class', 'label').text(property);
        row.append('span').attr('class', 'value').text(body[property]);
      }
    }
    tooltip.classed('hidden', false);
  };

  /**
   * Set the selection that will display the name of the visualization.
   */
  ui.setTitle = function(_) {
    if (typeof _ === 'string') title.text(_);
    else throw Error('ui: title must be of type string');
  };

  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

  ui.hierarchies = function(_) {
    if (!arguments.length) return hierarchies;
    if (typeof _ === 'function') hierarchies = _;
    else throw Error('ui: hierarchies must be of type function');
    return ui;
  };

  ui.dropDownMenu = function(_) {
    if (!arguments.length) return dropDownMenu;
    if (typeof _ === 'object') dropDownMenu = _;
    else throw Error('ui: dropDownMenu must be of type object');
    return ui;
  };

  ui.tooltip = function(_) {
    if (!arguments.length) return tooltip;
    if (typeof _ === 'object') tooltip = _;
    else throw Error('ui: tooltip must be of type object');
    return ui;
  };

  ui.timestampSliders = function(_) {
    if (!arguments.length) return timestampSliders;
    if (typeof _ === 'object') timestampSliders = _;
    else throw Error('ui: timestampSliders must be of type object');
    return ui;
  };

  ui.swapDatasetButton = function(_) {
    if (!arguments.length) return swapDatasetButton;
    if (typeof _ === 'object') swapDatasetButton = _;
    else throw Error('ui: swapDatasetButton must be of type object');
    return ui;
  };

  ui.title = function(_) {
    if (!arguments.length) return title;
    if (typeof _ === 'object') title = _;
    else throw Error('ui: title must be of type object');
    return ui;
  };

  ui.rulerLength = function(_) {
    if (!arguments.length) return rulerLength;
    if (typeof _ === 'number') rulerLength = _;
    else throw Error('ui: rulerLength must be of type number');
    return ui;
  };

  return ui;
};