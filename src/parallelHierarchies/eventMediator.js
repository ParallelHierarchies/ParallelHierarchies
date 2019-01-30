import NotificationViewer from './notificationViewer';
import ItemValueProvider from './itemValueProvider';

class EventMediator {
  constructor() {
    this.mediator = {};

    this.myNotificationViewer = new NotificationViewer();
    this.myNotificationViewer.init();

    this.ribbonController = null;
    this.dimensionController = null;

    this.pendingHighlightTiemouts = [];

    this.uiController = null;
    this.hierarchiesComponent = null;
    this.useHighlighting = true;
  }

  notify (type, message) {
    this.handleEvent({ type, message });
  }

  handleEvent(event) {
    if (event.type === 'categoryPositionChanged') {
      this.ribbonController.updateVerticalRibbonPositions(event.message.category);
    } else if (event.type === 'categoryClicked') {
      this.dimensionController.updateDimensionsAfterQueryChange();
      this.ribbonController.updateAfterQueryChange();
      this.ribbonController.updateActiveRibbons();
      this.uiController.drawPercentageBars();
    } else if (event.type === 'categoryMouseEnter') {
      this.onElementMouseEvent(event.message);
    } else if (event.type === 'categoryMouseMove') {
      this.uiController.moveTooltip(event.message.event);
    } else if (event.type === 'categoryMouseOut') {
      this.onElementMouseEvent(null);
    } else if (event.type === 'categoryDraggingStarted') {
      this.useHighlighting = false;
    } else if (event.type === 'categoryDraggingEnded') {
      this.useHighlighting = true;
    } else if (event.type === 'categoryOrderingChanged') {
      const message = `${this.ribbonController.getTotalNumberOfIntersections()} ribbon intersections`;
      this.myNotificationViewer.hint(message);
    } else if (event.type === 'dimensionPositionChanged') {
      this.ribbonController.updateAfterQueryChange(event.message.positions);
      this.ribbonController.updateActiveRibbons();
      this.uiController.drawPercentageBars();
    } else if (event.type === 'dimensionDragged') {
      this.ribbonController.updateHorizontalRibbonPositions(false);
    } else if (event.type === 'dimensionDragEnd') {
      this.ribbonController.updateHorizontalRibbonPositions(true);
    } else if (event.type === 'dimensionAdded') {
      this.dimensionController.addDimension(event.message);
      this.ribbonController.updateAfterQueryChange();
      this.ribbonController.updateActiveRibbons();
      this.uiController.drawPercentageBars();
    } else if (event.type === 'dimensionRemoved') {
      this.dimensionController.removeDimension(event.message);
      this.ribbonController.updateAfterQueryChange();
      this.ribbonController.updateActiveRibbons();
      this.uiController.drawPercentageBars();
    } else if (event.type === 'ribbonMouseEnter') {
      this.onElementMouseEvent(event.message);
    } else if (event.type === 'ribbonMouseMove') {
      this.uiController.moveTooltip(event.message.event);
    } else if (event.type === 'ribbonMouseOut') {
      this.onElementMouseEvent(null);
    } else if (event.type === 'resize') {
      this.dimensionController.height(this.hierarchiesComponent.height());
      this.dimensionController.updateOnResize();
      this.ribbonController.updateAfterQueryChange();
      this.ribbonController.updateActiveRibbons();
    } else if (event.type === 'error') {
      this.myNotificationViewer.error(event.message);
    } else if (event.type === 'warning') {
      this.myNotificationViewer.warning(event.message);
    } else if (event.type === 'hint') {
      this.myNotificationViewer.hint(event.message);
    } else if (event.type === 'uncertaintyModeChanged') {
      this.ribbonController.updateActiveRibbons();
      this.dimensionController.updateDimensionsAfterQueryChange();
    } else if (event.type === 'categoryComparisonModeChanged') {
      this.ribbonController.updateActiveRibbons();
      this.dimensionController.updateDimensionsAfterQueryChange();
    } else if (event.type === 'categoryUncertaintyModeChanged') {
      this.ribbonController.updateActiveRibbons();
      this.dimensionController.updateDimensionsAfterQueryChange();
    } else if (event.type === 'uncertaintyColorSchemeChanged') {
      this.ribbonController.updateActiveRibbons();
      this.dimensionController.updateDimensionsAfterQueryChange();
    } else if (event.type === 'primaryAggregateDimensionChanged') {
      ItemValueProvider.primaryAggregateDimension = event.message;
      this.hierarchiesComponent.updateVerticalScaleDomain();

      this.dimensionController.updateDimensionsAfterQueryChange();
      this.ribbonController.updateAfterQueryChange();
      this.ribbonController.updateActiveRibbons();
      this.uiController.drawPercentageBars();
    } else if (event.type === 'secondaryAggregateDimensionChanged') {
      ItemValueProvider.secondaryAggregateDimension = event.message;
      this.hierarchiesComponent.updateVerticalScaleDomain();

      this.dimensionController.updateDimensionsAfterQueryChange();
      this.ribbonController.updateAfterQueryChange();
      this.ribbonController.updateActiveRibbons();
      this.uiController.drawPercentageBars();
    } else if (event.type === 'intersectionMinimizationModeChanged') {
      if (this.hierarchiesComponent.useIntersectionMinimization()) {
        const useGreedy = this.hierarchiesComponent.useGreedyOptimization();
        this.ribbonController.optimizeIntersections(useGreedy);
        this.dimensionController.updateDimensionsAfterQueryChange();
      } else {
        this.dimensionController.getObservedDimensions()
          .forEach(dim => dim.sortHierarchyByDescription());

        this.ribbonController.updateActiveRibbons();
        this.ribbonController.updateVerticalRibbonPositions();
      }

      const message = `${this.ribbonController.getTotalNumberOfIntersections()} ribbon intersections`;
      this.myNotificationViewer.hint(message);
    } else if (event.type === 'acordionModeChanged') {
      this.hierarchiesComponent.redraw();
    } else if (event.type === 'rotateView') {
      this.dimensionController.updateOnRotate();
    } else {
      throw new TypeError();
    }
  }

  /**
   * On mouse over events, highlight every category and ribbon that shares items with the category
   * which emitted the mouse-over event.
   * @param   {object} message message from hovered category
   * @return  {void}
   */
  onElementMouseEvent(message) {
    let items;
    let label;

    if (message == null) {
      items = {};
      label = '';
    } else if (message.category != null) {
      ({ items, label } = message.category.data());
    } else if (message.ribbon != null) {
      ({ items } = message.ribbon);

      const sourceLabel = message.ribbon.source.data().label;
      const targetLabel = message.ribbon.target.data().label;
      label = `${sourceLabel} → ${targetLabel}`;
    }

    if (this.useHighlighting) this.highlight(items);

    if (message === null) {
      this.uiController.hideTooltip();
    } else if (this.useHighlighting) {
      this.tooltip(label, Object.values(items), message.event);
    }
  }

  /**
   * Sends the 'highlight' event to all ribbons and dimensions, providing dictionary of items.
   * @param   {object} itemMap mapping from itemID -> item
   * @return  {void}
   */
  highlight(itemMap) {
    const observedDimensions = this.dimensionController.getObservedDimensions();
    const observedRibbons = this.ribbonController.getObservedRibbons();

    window.clearTimeout(this.pendingHighlightTiemouts);

    this.pendingHighlightTiemouts = setTimeout(() => {
      observedDimensions.forEach((dim) => { dim.highlight(itemMap); });
      observedRibbons.forEach((rib) => { rib.highlight(itemMap); });
    }, 0);
  }

  /**
   * Sends the tooltip information to the ui component to display metadata about highlighted items.
   * @param   {string} label        'header' of tooltip
   * @param   {object} listOfItems  items that are highlighted
   * @param   {object} event        d3.event that yielded the highlight function
   * @return  {void}
   */
  tooltip (label, listOfHighlightedItems, event) {
    if (this.hierarchiesComponent.useCategoryFisheye()) return;
    const listOfAllItems = this.hierarchiesComponent.getListOfAllItems();

    const activeHighlightedValue = ItemValueProvider.getActiveItemValueSum(listOfHighlightedItems);

    const allItemsValue = ItemValueProvider.getAnyItemValueSum(listOfAllItems);

    const anyActiveValue = ItemValueProvider.getActiveItemValueSum(listOfAllItems);

    const visible = `${parseInt((activeHighlightedValue / anyActiveValue) * 10000, 10) / 100}%`;
    const total = `${parseInt((activeHighlightedValue / allItemsValue) * 10000, 10) / 100}%`;
    let absolute = activeHighlightedValue;

    // separate groups of 1000s by ',' for better readability of large numbers
    absolute = (`${absolute}`).split('').reverse().join('');
    absolute = absolute.replace(/(.{3})/g, '$1,');
    absolute = absolute.split('').reverse().join('');
    absolute = absolute.replace(/^,/, ''); // removes heading ,

    const body = { absolute, visible, total };

    this.uiController.showTooltip(label, body, event);
  }
}

const instance = new EventMediator();

export default instance;