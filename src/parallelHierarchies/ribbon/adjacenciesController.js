import IntersectionOptimizer from './intersectionOptimizer';
import ValueProvider from '../itemValueProvider';

const AdjacenciesController = function() {
  const controller = {};

  // minimizes intersections between ribbons
  const intersectionOptimizer = IntersectionOptimizer();

  const adjacencies = [];

  let hierarchies;
  let itemList;
  let itemID;

  /**
   * Update the adjacencies mapping between all neighboring dimensions. The mapping stores entries
   * for all categories that have at least one item that contains both values in those dimensions.
   * @return {array} adjacencies objects for every pair of neighboring dimensions, sorted by
   *                 position in the visualization from left to right
   */
  controller.updateAfterQueryChange = function() {
    let sourceLabel;
    let targetLabel;
    let sourceDim;
    let targetDim;
    let sourceDimName;
    let targetDimName;
    let sourceQueryTerm;
    let targetQueryTerm;

    let sourceQs;
    let targetQs;

    const observedDimensions = hierarchies.getObservedDimensions();

    // cached number of observed dimensions
    const numberAdjacencies = observedDimensions.length - 1;

    // map of query lists per dimension name
    const activeQueries = getActiveQueryMap();

    adjacencies.length = 0;

    // go through all items once and add the links between neighboring categories per item. This
    // approach does not require huge lists of items to be intersected, so it should perform better
    // than the category centred way.
    itemList.forEach((item) => {
      // inactive items don't fulfill the queries
      if (!item.active) return;
      // items with no value do not show up as height of ribbons
      if (ValueProvider.getItemValue(item) === 0) return;

      // go through all pairs of neighboring dimensions and create new links for the ribbondata
      // on the fly. If the path was already created, simply add a reference to the current item
      // to the link's 'item' list
      for (let i = 0; i < numberAdjacencies; i++) {
        sourceDim = observedDimensions[i];
        targetDim = observedDimensions[i + 1];

        sourceDimName = sourceDim.data().name;
        targetDimName = targetDim.data().name;

        sourceQs = activeQueries[sourceDimName];
        targetQs = activeQueries[targetDimName];

        // the iteration conditions make sure that the adjacencies is set at least once for empty
        // queries and only as many times as there are active queries otherwise
        for (let sq = 0; (sq < sourceQs.length && sourceQs.length > 0)
                      || (sq === 0 && sourceQs.length === 0); sq++) {

          for (let tq = 0; (tq < targetQs.length && targetQs.length > 0)
                        || (tq === 0 && targetQs.length === 0); tq++) {

            sourceQueryTerm = (sourceQs[sq] || []);
            targetQueryTerm = (targetQs[tq] || []);

            // check if this item matches this query for this dimension, otherwise go to next query
            // and check again
            if (doesItemMatchQueryInDimension(item, sourceQueryTerm, sourceDimName)) {
              if (doesItemMatchQueryInDimension(item, targetQueryTerm, targetDimName)) {
                // get the labels (values of item matching query) for both dimensions
                sourceLabel = getItemValueInDimensionForQuery(item, sourceQueryTerm, sourceDimName);
                targetLabel = getItemValueInDimensionForQuery(item, targetQueryTerm, targetDimName);

                createAdjacencyMapping(sourceLabel, targetLabel, sourceDim, targetDim, i);

                // add reference to the item itself. The full 'items' property is used later on to
                // calculate heights and offsets
                adjacencies[i][sourceLabel][targetLabel].items[item[itemID]] = item;
              }
            }
          }
        }
      }
    });

    return adjacencies;
  };

  /**
   * For every active dimension, get a list of their active queries
   * @return {object} map of dimensionName -> list of list of query terms
   */
  let getActiveQueryMap = function() {
    const observedDimensions = hierarchies.getObservedDimensions();
    const activeQueries = {};
    let q;

    observedDimensions.forEach((dim) => {
      // in case a dimension is active multiple times, getting query mapping only once is sufficient
      if (activeQueries[dim.data().name] != null) return;

      q = hierarchies.getActiveQueries(dim.data().queryTree);

      // only use length for this
      // activeQueries[dim.data().name] = Object.keys(q);
      activeQueries[dim.data().name] = q;
    });

    return activeQueries;
  };

  /**
   * Find out if an item matches a query on a given dimension.
   * @param   {object}  item          an item from the itemList
   * @param   {array}   query         a list of strings for one query in a dimension
   * @param   {string}  dimensionName name of the dimension the query is formulated on
   * @return  {boolean}               whether this item matches all terms of the query in the given
   *                                  dimension
   */
  let doesItemMatchQueryInDimension = function(item, query, dimensionName) {
    const itemValue = item[dimensionName];

    if (query.length === 0) return true;

    // if the query contains entries, this means the itemValue is an object containing entries for
    // levels of hierarchy of this dimension. Therefore, use a list of values of this object.
    const itemValueList = Object.values(itemValue);

    // item must have more values than there are query terms to match the query
    if (query.length >= itemValueList.length) return false;

    // get a prefix of this list the same length as the query (omitting irrelevant values)
    const itemValueListPrefix = itemValueList.slice(0, query.length);

    return compareLists(query, itemValueListPrefix);
  };

  /**
   *
   * @param   {object}  item          an item from the itemList
   * @param   {array}   query         a list of strings for one query in a dimension
   * @param   {string}  dimensionName name of the dimension the query is formulated on
   * @return  {string}                label of item for this query in the given dimension
   */
  let getItemValueInDimensionForQuery = function(item, query, dimensionName) {
    const itemValue = item[dimensionName];

    if (query.length === 0) {
      if (typeof itemValue === 'string') return `${dimensionName}:${itemValue}`;
    }

    const itemValueList = Object.values(itemValue);
    const itemValuesForQuery = itemValueList.slice(0, query.length + 1);

    return `${dimensionName}:${itemValuesForQuery.join('###')}`;
  };

  /**
   * Creates a new entry in the adjacencies from source category to target category if none exists.
   * @param   {string}    sourceLabel     category for source dimension
   * @param   {string}    targetLabel     category for target dimension
   * @param   {function}  sourceDim       source dimension generator
   * @param   {function}  targetDim       target dimension generator
   * @param   {number}    adjacencyIndex  position in the adjacencies
   * @return  {object}                    the mapping from source to target category
   */
  let createAdjacencyMapping = function(
    sourceLabel, targetLabel, sourceDim, targetDim,
    adjacencyIndex,
  ) {
    // initialize each level of the adjacency if it was not yet created
    if (adjacencies[adjacencyIndex] == null) {
      adjacencies[adjacencyIndex] = {};
    }
    if (adjacencies[adjacencyIndex][sourceLabel] == null) {
      adjacencies[adjacencyIndex][sourceLabel] = {};
    }
    if (adjacencies[adjacencyIndex][sourceLabel][targetLabel] == null) {

      // find the category generators representing the labels for source and target dimension
      const sourceCategory = sourceDim.getActiveLeafCategories()
        .find(cat => (cat.data().descriptor === sourceLabel));

      const targetCategory = targetDim.getActiveLeafCategories()
        .find(cat => (cat.data().descriptor === targetLabel));

      adjacencies[adjacencyIndex][sourceLabel][targetLabel] = {
        'height': 0,
        'source': sourceCategory,
        'target': targetCategory,
        'items': {},
        'targetOffset': 0,
        'sourceOffset': 0,
      };
    }

    return adjacencies[adjacencyIndex][sourceLabel][targetLabel];
  };

  // const randomizeCategoryHierarchies = function() {
  //   const dimensions = hierarchies.getObservedDimensions();
  //   dimensions.forEach(dim => dim.sortCategoriesRandomly());
  // };

  const getCategoryOrders = function() {
    const dimensions = hierarchies.getObservedDimensions();
    const categoryOrders = dimensions
      .map(dim => dim.getActiveLeafCategories())
      .map(catList => catList.sort((a, b) => a.y() - b.y()))
      .map(catList => catList.map(cat => cat.data().descriptor))
      .map((catList) => {
        const orderObj = {};
        catList.forEach((cat, i) => { orderObj[cat] = i; });
        return orderObj;
      });

    return categoryOrders;
  };

  controller.getTotalNumberOfIntersections = function() {
    const orders = getCategoryOrders();
    return intersectionOptimizer.getIntersections(adjacencies, orders);
  };

  /**
   * Using the optimized order of categories, update the position of ribbons and categories
   * accordingly to reduce clutter between dimensions and increase readability.
   * @param  {number} iterations number of iterations
   * @return {void}
   */
  controller.minimizeIntersections = function(useGreedy = false) {
    const dimensions = hierarchies.getObservedDimensions();

    const optimizedOrders = intersectionOptimizer.barycentricMethod(adjacencies, useGreedy);
    dimensions.forEach((dim, i) => dim.sortByOrdering(optimizedOrders[i]));

    // dimensions.forEach(dim => dim.sortByBestRandomPositions());
  };

  /**
   * Flattens the adjacency into a list of paths.
   * @return {obect} unordered list of unique paths between categories
   */
  controller.getListOfPaths = function() {
    const pathList = [];

    adjacencies.forEach((adjacency) => {
      Object.keys(adjacency).forEach((source) => {
        Object.keys(adjacency[source]).forEach((target) => {
          pathList.push(adjacency[source][target]);
        });
      });
    });

    return pathList;
  };

  /**
   * Checks whether or not two (flat) lists store the same values on every position.
   * @param   {object}  listA  the first list
   * @param   {object}  listB  the second list
   * @returns {boolean}        whether or not both lists store the same values on every position
   */
  let compareLists = function(listA, listB) {
    if (listA.length !== listB.length) return false;

    let match = true;
    for (let i = 0; match && i < listA.length; i++) {
      match = match && listA[i] === listB[i];
    }

    return match;
  };

  controller.getAdjacencies = function() { return adjacencies; };


  // GETTERS AND SETTERS ///////////////////////////////////////////////////////////////////////////

  controller.hierarchies = function(_) {
    if (!arguments.length) return hierarchies;
    hierarchies = _;
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

  return controller;
};

export default AdjacenciesController;