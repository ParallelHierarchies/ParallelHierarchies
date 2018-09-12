import NotificationViewer from './notificationViewer';
import ItemValueProvider from './itemValueProvider';

const EventMediator = function() {

  const mediator = {};

  const myNotificationViewer = new NotificationViewer();
  myNotificationViewer.init();

  let ribbonController;
  let dimensionController;

  let pendingHighlightTiemouts;

  let uiController;
  let hierarchiesComponent;
  let useHighlighting = true;

  mediator.notify = function(type, message) {
    handleEvent({ type, message });
  };

  let handleEvent = function(event) {
    if (event.type === 'categoryPositionChanged') {
      ribbonController.updateVerticalRibbonPositions(event.message.category);
    } else if (event.type === 'categoryClicked') {
      dimensionController.updateDimensionsAfterQueryChange();
      ribbonController.updateAfterQueryChange();
      ribbonController.updateActiveRibbons();
      uiController.drawPercentageBars();
    } else if (event.type === 'categoryMouseEnter') {
      onElementMouseEvent(event.message);
    } else if (event.type === 'categoryMouseMove') {
      uiController.moveTooltip(event.message.event);
    } else if (event.type === 'categoryMouseOut') {
      onElementMouseEvent(null);
    } else if (event.type === 'categoryDraggingStarted') {
      useHighlighting = false;
    } else if (event.type === 'categoryDraggingEnded') {
      useHighlighting = true;
    } else if (event.type === 'categoryOrderingChanged') {
      const message = `${ribbonController.getTotalNumberOfIntersections()} ribbon intersections`;
      myNotificationViewer.hint(message);
    } else if (event.type === 'dimensionPositionChanged') {
      ribbonController.updateAfterQueryChange(event.message.positions);
      ribbonController.updateActiveRibbons();
      uiController.drawPercentageBars();
    } else if (event.type === 'dimensionDragged') {
      ribbonController.updateHorizontalRibbonPositions(false);
    } else if (event.type === 'dimensionDragEnd') {
      ribbonController.updateHorizontalRibbonPositions(true);
    } else if (event.type === 'dimensionAdded') {
      dimensionController.addDimension(event.message);
      ribbonController.updateAfterQueryChange();
      ribbonController.updateActiveRibbons();
      uiController.drawPercentageBars();
    } else if (event.type === 'dimensionRemoved') {
      dimensionController.removeDimension(event.message);
      ribbonController.updateAfterQueryChange();
      ribbonController.updateActiveRibbons();
      uiController.drawPercentageBars();
    } else if (event.type === 'ribbonMouseEnter') {
      onElementMouseEvent(event.message);
    } else if (event.type === 'ribbonMouseMove') {
      uiController.moveTooltip(event.message.event);
    } else if (event.type === 'ribbonMouseOut') {
      onElementMouseEvent(null);
    } else if (event.type === 'resize') {
      dimensionController.height(hierarchiesComponent.height());
      dimensionController.updateOnResize();
      ribbonController.updateAfterQueryChange();
      ribbonController.updateActiveRibbons();
    } else if (event.type === 'error') {
      myNotificationViewer.error(event.message);
    } else if (event.type === 'warning') {
      myNotificationViewer.warning(event.message);
    } else if (event.type === 'hint') {
      myNotificationViewer.hint(event.message);
    } else if (event.type === 'uncertaintyModeChanged') {
      ribbonController.updateActiveRibbons();
      dimensionController.updateDimensionsAfterQueryChange();
    } else if (event.type === 'uncertaintyColorSchemeChanged') {
      ribbonController.updateActiveRibbons();
      dimensionController.updateDimensionsAfterQueryChange();
    } else if (event.type === 'primaryAggregateDimensionChanged') {
      ItemValueProvider.primaryAggregateDimension = event.message;
      ItemValueProvider.secondaryAggregateDimension = event.message;

      dimensionController.updateDimensionsAfterQueryChange();
      ribbonController.updateAfterQueryChange();
      ribbonController.updateActiveRibbons();
      uiController.drawPercentageBars();
    } else if (event.type === 'secondaryAggregateDimensionChanged') {
      // ItemValueProvider.secondaryAggregateDimension = event.message;
      // hierarchiesComponent.updateVerticalScaleDomain();

      // dimensionController.updateDimensionsAfterQueryChange();
      // ribbonController.updateAfterQueryChange();
      // ribbonController.updateActiveRibbons();
      // uiController.drawPercentageBars();
    } else if (event.type === 'intersectionMinimizationModeChanged') {
      if (hierarchiesComponent.useIntersectionMinimization()) {
        ribbonController.optimizeIntersections(hierarchiesComponent.useGreedyOptimization());
        dimensionController.updateDimensionsAfterQueryChange();
      } else {
        dimensionController.getObservedDimensions()
          .forEach(dim => dim.sortHierarchyByDescription());

        ribbonController.updateActiveRibbons();
        ribbonController.updateVerticalRibbonPositions();
      }

      const message = `${ribbonController.getTotalNumberOfIntersections()} ribbon intersections`;
      myNotificationViewer.hint(message);
    } else {
      throw new TypeError();
    }
  };

  /**
   * On mouse over events, highlight every category and ribbon that shares items with the category
   * which emitted the mouse-over event.
   * @param   {object} message message from hovered category
   * @return  {void}
   */
  let onElementMouseEvent = function(message) {
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

    if (useHighlighting) highlight(items);

    if (message === null) {
      uiController.hideTooltip();
    } else if (useHighlighting) {
      tooltip(label, Object.values(items), message.event);
    }
  };

  /**
   * Sends the 'highlight' event to all ribbons and dimensions, providing dictionary of items.
   * @param   {object} itemMap mapping from itemID -> item
   * @return  {void}
   */
  let highlight = function(itemMap) {
    const observedDimensions = dimensionController.getObservedDimensions();
    const observedRibbons = ribbonController.getObservedRibbons();

    window.clearTimeout(pendingHighlightTiemouts);

    pendingHighlightTiemouts = setTimeout(() => {
      observedDimensions.forEach((dim) => { dim.highlight(itemMap); });
      observedRibbons.forEach((rib) => { rib.highlight(itemMap); });
    }, 0);
  };

  /**
   * Sends the tooltip information to the ui component to display metadata about highlighted items.
   * @param   {string} label        'header' of tooltip
   * @param   {object} listOfItems  items that are highlighted
   * @param   {object} event        d3.event that yielded the highlight function
   * @return  {void}
   */
  let tooltip = function(label, listOfHighlightedItems, event) {
    if (hierarchiesComponent.useCategoryFisheye()) return;
    const listOfAllItems = hierarchiesComponent.getListOfAllItems();

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

    uiController.showTooltip(label, body, event);
  };

  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

  mediator.ribbonController = function(_) {
    if (!arguments.length) return ribbonController;
    ribbonController = _;
    return mediator;
  };
  mediator.dimensionController = function(_) {
    if (!arguments.length) return dimensionController;
    dimensionController = _;
    return mediator;
  };
  mediator.uiController = function(_) {
    if (!arguments.length) return uiController;
    uiController = _;
    return mediator;
  };
  mediator.hierarchiesComponent = function(_) {
    if (!arguments.length) return hierarchiesComponent;
    hierarchiesComponent = _;
    return mediator;
  };


  return mediator;
};

const instance = new EventMediator();

export default instance;