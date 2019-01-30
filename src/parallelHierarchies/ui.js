import * as d3 from 'd3';

import VisiblePercentageBars from './percentageBars';
import UncertaintyProvider, { RIBBON_UNCERTAINTY_MODES, UNCERTAINTY_COLOR_SCHEMES, CATEGORY_UNCERTAINTY_MODES } from './uncertaintyProvider';
import ValueSelectionComponent from './valueSelectionComponent';
import ValueProvider, { CATEGORY_COMPARISON_MODES } from './itemValueProvider';
import EventMediator from './eventMediator';
import FileDownloader from '../plugins/fileDownloader';

export default class UIComponent {
  constructor() {

    this.root = null;

    this.data = null;
    this.hierarchies = null;

    this.useDarkTheme = true;

    // D3 CONFIGURATION
    this.dropDownMenu = null;
    this.tooltip = null;
    this.downloadSVGButton = null;
    this.downloadPNGButton = null;
    this.downloadPDFButton = null;

    this.percentageBarSelection = null;
    this.percentageBarGenerator = null;

    this.ribbonUncertaintySelection = null;
    this.categoryUncertaintyModeSelection = null;
    this.uncertaintyColorSchemeSelection = null;
    this.categoryComparisonSelection = null;

    this.valueSelectionComponent = null;

    this.title = null;
    this.rulerLength = 1000;
  }

  init(selection) {
    if (this.hierarchies == null) throw Error('ui: hierarchies must be set');
    if (this.tooltip == null) throw Error('ui: tooltip must be set');

    this.root = selection;

    this.hierarchies.dataProvider().getData().then((response) => {
      // FIXME: timeout to wait for parallelhierarchies component, which configures dependencies...
      setTimeout(() => {
        this.data = response;
        this.draw();
      }, 100);
    });
  }

  draw() {
    // if a titleSelection was set, set it's text to the value provided in schema
    if (this.title != null) this.title.text(this.data.schema.title);

    // get a list of properties in the items (=dimension names)
    const keys = this.hierarchies.dataProvider().getSchema().dimensions;

    this.dropDownMenu.selectAll('option').remove();
    this.dropDownMenu.append('option').text('Add Dimension ...').attr('disabled', true);
    for (let l = 0; l < keys.length; l++) {
      const label = keys[l];

      // do not list options for the item id and value properties
      this.dropDownMenu.append('option').text(label);
    }

    // add the clicked on dimension to the parallelhierarchies
    this.dropDownMenu.on('change', function() {
      EventMediator.notify('dimensionAdded', { 'name': this.value });
    });

    // add components to tooltip and hide it initially
    this.tooltip.append('p').attr('class', 'heading');
    this.tooltip.append('ul').attr('class', 'body');
    this.tooltip.classed('hidden', true);

    d3.select('body').classed('dark', this.useDarkTheme);

    this.ribbonUncertaintySelection.selectAll('option').remove();
    this.ribbonUncertaintySelection.append('option').text('ribbon uncertainty').attr('disabled', true);
    this.ribbonUncertaintySelection.selectAll('option').data(Object.keys(RIBBON_UNCERTAINTY_MODES), d => d).enter()
      .append('option')
      .attr('value', d => RIBBON_UNCERTAINTY_MODES[d])
      .text(d => d);

    this.ribbonUncertaintySelection.on('change', function() {
      ValueProvider.ribbonUncertaintyMode = +this.value;
      EventMediator.notify('uncertaintyModeChanged', ValueProvider.ribbonUncertaintyMode);
    });

    this.categoryUncertaintySelection.selectAll('option').remove();
    this.categoryUncertaintySelection
      .append('option')
      .text('category uncertainty').attr('disabled', true);
    this.categoryUncertaintySelection.selectAll('option')
      .data(Object.keys(CATEGORY_UNCERTAINTY_MODES), d => d).enter()
      .append('option')
      .attr('value', d => CATEGORY_UNCERTAINTY_MODES[d])
      .text(d => d);

    this.categoryUncertaintySelection.on('change', function() {
      ValueProvider.categoryUncertaintyMode = +this.value;
      EventMediator.notify('categoryUncertaintyModeChanged', ValueProvider.ribbonUncertaintyMode);
    });

    this.categoryComparisonSelection.selectAll('option').remove();
    this.categoryComparisonSelection
      .append('option')
      .text('category comparison').attr('disabled', true);
    this.categoryComparisonSelection.selectAll('option')
      .data(Object.keys(CATEGORY_COMPARISON_MODES), d => d).enter()
      .append('option')
      .attr('value', d => CATEGORY_COMPARISON_MODES[d])
      .text(d => d);

    this.categoryComparisonSelection.on('change', function() {
      ValueProvider.categoryComparisonMode = +this.value;
      EventMediator.notify('categoryComparisonModeChanged', ValueProvider.categoryComparisonMode);
    });

    this.uncertaintyColorSchemeSelection.selectAll('option').remove();
    this.uncertaintyColorSchemeSelection.append('option').text('uncertainty color schema').attr('disabled', true);
    this.uncertaintyColorSchemeSelection.selectAll('option').data(UNCERTAINTY_COLOR_SCHEMES, d => d).enter()
      .append('option')
      .attr('value', d => d)
      .text(d => d);

    this.uncertaintyColorSchemeSelection.on('change', function() {
      UncertaintyProvider.setColorSchema(this.value);
      EventMediator.notify('uncertaintyColorSchemeChanged');
    });


    this.drawPercentageBars();

    this.valueSelectionComponent = new ValueSelectionComponent();
    this.valueSelectionComponent.aggregateValues = this.hierarchies.aggregateDimensions();
    this.valueSelectionComponent.onPrimaryAggregateValueChanged = setPrimaryAggregateDimension;
    this.valueSelectionComponent.onSecondaryAggregateValueChanged = setSecondaryAggregateDimension;

    this.valueSelectionComponent.draw();

    d3.select('#foundBugNotice').classed('hidden', true);
    d3.select('footer ul')
      .on('mouseenter', () => d3.select('#foundBugNotice').classed('hidden', false))
      .on('mouseleave', () => d3.select('#foundBugNotice').classed('hidden', true));

    this.downloadSVGButton.on('click', () => {
      setTimeout(() => {
        const crowbar = new FileDownloader();
        crowbar.svgs = document.querySelectorAll('#parallelHierarchies');
        crowbar.downloadAsSVG();
        this.hierarchies.redraw();
      }, 0);
    });

    this.downloadPNGButton.on('click', () => {
      setTimeout(() => {
        const crowbar = new FileDownloader();
        crowbar.svgs = document.querySelectorAll('#parallelHierarchies');
        crowbar.downloadAsPNG();
        this.hierarchies.redraw();
      }, 0);
    });

    this.downloadPDFButton.on('click', () => {
      const crowbar = new FileDownloader();
      crowbar.svgs = document.querySelectorAll('#parallelHierarchies');
      crowbar.downloadAsPDF();
    });
  }

  /*
   * Adds visual overview indicating the percentage of items selected per dimension as well as
   * the visible percentage.
   */
  drawPercentageBars() {
    const dimensionEntries = {};
    const anyItemValueSum = ValueProvider.getAnyItemValueSum(this.data.itemList);
    const activeItemValueSum = ValueProvider.getActiveItemValueSum(this.data.itemList);

    this.hierarchies.getObservedDimensions().forEach((dim) => {
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

    if (this.percentageBarGenerator === null) {
      this.percentageBarGenerator = new VisiblePercentageBars()
        .height(70)
        .max(anyItemValueSum)
        .visible(activeItemValueSum)
        .dimensions(dimensionEntries);

      this.percentageBarSelection.call(this.percentageBarGenerator);
    } else {
      this.percentageBarGenerator
        .max(anyItemValueSum)
        .visible(activeItemValueSum)
        .dimensions(dimensionEntries)
        .updateView();
    }
  }

  /**
   * Adds a visual element respresenting a ruler which can be used to compare heights in the
   * parallHierarchies.
   */
  addRuler() {
    const ruler = d3.select('body').append('div').attr('class', 'ruler grabbable');

    // add horizontal line which cuts through the parallel Sets
    ruler.append('div')
      .attr('class', 'guideline')
      .style('width', `${this.rulerLength}px`);

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
        .style('left', `${Math.min(d3.event.x - 30, this.rulerLength - 50)}px`);
    });

    // add drag behavior: dragging the ruler moves it vertically
    ruler.call(d3.drag()
      .on('start', function() { d3.select(this).classed('dragging', true); })
      .on('drag', function() {
        d3.select(this).style('transform', `translateY(${d3.event.y}px)`);
      })
      .on('end', function() { d3.select(this).classed('dragging', false); }));
  }

  setCategoryInteraction(flag) {
    this.hierarchies.useCategoryFisheye(flag === 'fisheye');
    this.hierarchies.useCategoryDragging(flag === 'drag');
  }

  /**
   * Sets the text inside the tooltip to the given parameters.
   * @param   {string}  heading heading of tooltilp
   * @param   {object}  body    body of tooltip. Every property gets one entry in the tooltip
   * @param   {object}  event   d3.event on mouseover
   * @return  {void}
   */
  showTooltip(heading, body, event) {
    this.tooltip.select('p.heading').text(heading);
    this.tooltip.select('ul.body').selectAll('li').remove();

    // tooltip.select('p.body').text(body);
    if (typeof body === 'string') {
      this.tooltip.select('ul.body').append('li').text(body);
    } else if (typeof body === 'object') {
      let row;
      Object.keys(body).forEach((property) => {
        row = this.tooltip.select('ul.body').append('li');
        row.append('span').attr('class', 'label').text(property);
        row.append('span').attr('class', 'value').text(body[property]);
      });
    }
    this.tooltip.classed('hidden', false);
    this.moveTooltip(event);
  }

  moveTooltip(event) {
    const ttWidth = +window.getComputedStyle(this.tooltip.node()).width.split('px')[0];
    const ttHeight = +window.getComputedStyle(this.tooltip.node()).height.split('px')[0];
    const ttPadding = 75;

    // keep tooltip inside the visible window, do not overshoot the edges
    const x = Math.max(Math.min(event.clientX, window.innerWidth - ttWidth - ttPadding), 0);
    let y = Math.max(event.clientY, 0);

    // move tooltip above cursor if its is placed at the bottom of screen to avoid flickering
    if (y > window.innerHeight - ttHeight - ttPadding) {
      y = event.clientY - ttHeight - ttPadding;
    }

    this.tooltip.style('left', `${x}px`).style('top', `${y}px`);
  }

  hideTooltip() {
    this.tooltip.classed('hidden', true);
  }

  /**
   * Set the selection that will display the name of the visualization.
   */
  setTitle(_) {
    if (typeof _ === 'string') this.title.text(_);
    else throw Error('ui: title must be of type string');
  }

  /**
   * Toggles between the color themes of the application [bright, dark]
   */
  toggleTheme() {
    this.useDarkTheme = !this.useDarkTheme;
    d3.select('body').classed('dark', this.useDarkTheme);
  }
}

function setPrimaryAggregateDimension(dimensionName) {
  EventMediator.notify('primaryAggregateDimensionChanged', dimensionName);
}

function setSecondaryAggregateDimension(dimensionName) {
  EventMediator.notify('secondaryAggregateDimensionChanged', dimensionName);
}