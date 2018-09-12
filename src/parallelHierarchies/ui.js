import * as d3 from 'd3';

import VisiblePercentageBars from './percentageBars';
import UncertaintyProvider, { UNCERTAINTY_MODES, UNCERTAINTY_COLOR_SCHEMES } from './uncertaintyProvider';
import ValueSelectionComponent from './valueSelectionComponent';
import ValueProvider from './itemValueProvider';
import EventMediator from './eventMediator';

const UIComponent = function() {
  let root;

  let data;
  let hierarchies;

  let useDarkTheme = true;

  // D3 CONFIGURATION
  let dropDownMenu;
  let tooltip;

  let percentageBarSelection;
  let percentageBarGenerator;

  let uncertaintySelection;
  let uncertaintyColorSchemeSelection;

  let valueSelectionComponent;

  let title;
  let rulerLength = 1000;

  const ui = function(selection) {
    if (hierarchies == null) throw Error('ui: hierarchies must be set');
    if (tooltip == null) throw Error('ui: tooltip must be set');

    root = selection;

    hierarchies.dataProvider().getData().then((response) => {
      data = response;
      draw();
    });
  };

  let draw = function() {
    // if a titleSelection was set, set it's text to the value provided in schema
    if (title != null) title.text(data.schema.title);

    // get a list of properties in the items (=dimension names)
    const keys = hierarchies.dataProvider().getSchema().dimensions;

    dropDownMenu.selectAll('option').remove();
    dropDownMenu.append('option').text('Add Dimension ...').attr('disabled', true);
    for (let l = 0; l < keys.length; l++) {
      const label = keys[l];

      // do not list options for the item id and value properties
      dropDownMenu.append('option').text(label);
    }

    // add the clicked on dimension to the parallelhierarchies
    dropDownMenu.on('change', function() {
      EventMediator.notify('dimensionAdded', { 'name': this.value });
    });

    // add components to tooltip and hide it initially
    tooltip.append('p').attr('class', 'heading');
    tooltip.append('ul').attr('class', 'body');
    tooltip.classed('hidden', true);

    d3.select('body').classed('dark', useDarkTheme);

    uncertaintySelection.selectAll('option').remove();
    uncertaintySelection.append('option').text('uncertainty').attr('disabled', true);
    uncertaintySelection.selectAll('option').data(Object.keys(UNCERTAINTY_MODES), d => d).enter()
      .append('option')
      .attr('value', d => UNCERTAINTY_MODES[d])
      .text(d => d);

    uncertaintySelection.on('change', function() {
      ValueProvider.uncertaintyMode = +this.value;
      EventMediator.notify('uncertaintyModeChanged', ValueProvider.uncertaintyMode);
    });

    uncertaintyColorSchemeSelection.selectAll('option').remove();
    uncertaintyColorSchemeSelection.append('option').text('uncertainty color schema').attr('disabled', true);
    uncertaintyColorSchemeSelection.selectAll('option').data(UNCERTAINTY_COLOR_SCHEMES, d => d).enter()
      .append('option')
      .attr('value', d => d)
      .text(d => d);

    uncertaintyColorSchemeSelection.on('change', function() {
      UncertaintyProvider.setColorSchema(this.value);
      EventMediator.notify('uncertaintyColorSchemeChanged');
    });


    ui.drawPercentageBars();

    valueSelectionComponent = new ValueSelectionComponent();
    valueSelectionComponent.aggregateValues = hierarchies.aggregateDimensions();
    valueSelectionComponent.onPrimaryAggregateValueChanged = ui.setPrimaryAggregateDimension;
    valueSelectionComponent.onSecondaryAggregateValueChanged = ui.setSecondaryAggregateDimension;

    valueSelectionComponent.draw();

    d3.select('#foundBugNotice').classed('hidden', true);
    d3.select('footer ul')
      .on('mouseenter', () => d3.select('#foundBugNotice').classed('hidden', false))
      .on('mouseleave', () => d3.select('#foundBugNotice').classed('hidden', true));
  };

  /*
   * Adds visual overview indicating the percentage of items selected per dimension as well as
   * the visible percentage.
   */
  ui.drawPercentageBars = function() {
    const dimensionEntries = {};
    const anyItemValueSum = ValueProvider.getAnyItemValueSum(data.itemList);
    const activeItemValueSum = ValueProvider.getActiveItemValueSum(data.itemList);

    hierarchies.getObservedDimensions().forEach((dim) => {
      const dimensionItems = [];

      dim.getActiveLeafCategories()
        .map(c => c.data())
        .forEach((cat) => {
          Object.values(cat.items).forEach(item => dimensionItems.push(item));
        });

      const dimensionValue = ValueProvider.getAnyItemValueSum(dimensionItems);

      dimensionEntries[dim.data().name] = {
        value: dimensionValue,
        color: dim.data().color,
      };
    });

    if (percentageBarGenerator === undefined) {
      percentageBarGenerator = new VisiblePercentageBars()
        .height(70)
        .max(anyItemValueSum)
        .visible(activeItemValueSum)
        .dimensions(dimensionEntries);

      percentageBarSelection.call(percentageBarGenerator);
    } else {
      percentageBarGenerator
        .max(anyItemValueSum)
        .visible(activeItemValueSum)
        .dimensions(dimensionEntries)
        .updateView();
    }
  };

  /**
   * Adds a visual element respresenting a ruler which can be used to compare heights in the
   * parallHierarchies.
   */
  ui.addRuler = function() {
    const ruler = root.append('div').attr('class', 'ruler grabbable');

    // add horizontal line which cuts through the parallel Sets
    ruler.append('div')
      .attr('class', 'guideline')
      .style('width', `${rulerLength}px`);

    // add a handle for interaction
    ruler.append('div')
      .attr('class', 'handle');

    // add a remove region to delete the ruler
    ruler.append('div')
      .attr('class', 'delete clickable')
      .on('click', function() { d3.select(this.parentNode).remove(); });

    // handle follows cursor
    ruler.on('mousemove', function() {
      // restrict handle movement to length of ruler to not cover up the delete region
      d3.select(this).select('.handle')
        .style('left', `${Math.min(d3.event.x - 30, rulerLength - 50)}px`);
    });

    // add drag behavior: dragging the ruler moves it vertically
    ruler.call(d3.drag()
      .on('start', function() { d3.select(this).classed('dragging', true); })
      .on('drag', function() {
        d3.select(this).style('transform', `translateY(${d3.event.y}px)`);
      })
      .on('end', function() { d3.select(this).classed('dragging', false); }));
  };

  ui.setCategoryInteraction = function(flag) {
    hierarchies.useCategoryFisheye(flag === 'fisheye');
    hierarchies.useCategoryDragging(flag === 'drag');
  };

  ui.setPrimaryAggregateDimension = function(dimensionName) {
    EventMediator.notify('primaryAggregateDimensionChanged', dimensionName);
  };

  ui.setSecondaryAggregateDimension = function(dimensionName) {
    EventMediator.notify('secondaryAggregateDimensionChanged', dimensionName);
  };

  /**
   * Sets the text inside the tooltip to the given parameters.
   * @param   {string}  heading heading of tooltilp
   * @param   {object}  body    body of tooltip. Every property gets one entry in the tooltip
   * @param   {object}  event   d3.event on mouseover
   * @return  {void}
   */
  ui.showTooltip = function(heading, body, event) {
    tooltip.select('p.heading').text(heading);
    tooltip.select('ul.body').selectAll('li').remove();

    // tooltip.select('p.body').text(body);
    if (typeof body === 'string') {
      tooltip.select('ul.body').append('li').text(body);
    } else if (typeof body === 'object') {
      let row;
      Object.keys(body).forEach((property) => {
        row = tooltip.select('ul.body').append('li');
        row.append('span').attr('class', 'label').text(property);
        row.append('span').attr('class', 'value').text(body[property]);
      });
    }
    tooltip.classed('hidden', false);
    ui.moveTooltip(event);
  };

  ui.moveTooltip = function(event) {
    const ttWidth = +window.getComputedStyle(tooltip.node()).width.split('px')[0];
    const ttHeight = +window.getComputedStyle(tooltip.node()).height.split('px')[0];
    const ttPadding = 75;

    // keep tooltip inside the visible window, do not overshoot the edges
    const x = Math.max(Math.min(event.clientX, window.innerWidth - ttWidth - ttPadding), 0);
    let y = Math.max(event.clientY, 0);

    // move tooltip above cursor if its is placed at the bottom of screen to avoid flickering
    if (y > window.innerHeight - ttHeight - ttPadding) {
      y = event.clientY - ttHeight - ttPadding;
    }

    tooltip.style('left', `${x}px`).style('top', `${y}px`);
  };

  ui.hideTooltip = function() {
    tooltip.classed('hidden', true);
  };

  /**
   * Set the selection that will display the name of the visualization.
   */
  ui.setTitle = function(_) {
    if (typeof _ === 'string') title.text(_);
    else throw Error('ui: title must be of type string');
  };

  /**
   * Toggles between the color themes of the application [bright, dark]
   */
  ui.toggleTheme = function() {
    useDarkTheme = !useDarkTheme;
    d3.select('body').classed('dark', useDarkTheme);
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

  ui.percentageBarSelection = function(_) {
    if (!arguments.length) return percentageBarSelection;
    if (typeof _ === 'object') percentageBarSelection = _;
    else throw Error('ui: percentageBarSelection must be of type object');
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

  ui.useDarkTheme = function(_) {
    if (!arguments.length) return useDarkTheme;
    if (typeof _ === 'boolean') useDarkTheme = _;
    else throw Error('ui: useDarkTheme must be of type boolean');
    return ui;
  };

  ui.uncertaintySelection = function(_) {
    if (!arguments.length) return uncertaintySelection;
    if (typeof _ === 'object') uncertaintySelection = _;
    else throw Error('ui: uncertaintySelection must be of type object');
    return ui;
  };

  ui.uncertaintyColorSchemeSelection = function(_) {
    if (!arguments.length) return uncertaintyColorSchemeSelection;
    if (typeof _ === 'object') uncertaintyColorSchemeSelection = _;
    else throw Error('ui: uncertaintyColorSchemeSelection must be of type object');
    return ui;
  };

  return ui;
};

export default UIComponent;