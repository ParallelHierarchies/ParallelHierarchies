const DataConverter = function() {
  const converter = {};

  let hierarchies;
  let dataProvider;

  let color;

  const categoryTree = {};
  let dimensionsData = {};
  let initialDimensions = [];
  let itemList = [];

  // helper function to traverse the categoryTree recursively and insert items on every level
  // is called for every hierarchical dimension per item
  const recurseHierarchy = function(tree, parent, categoryList, item, dimensionName, currentLevel) {
    const next = categoryList[0]; // next category name in list
    const itemID = dataProvider.itemID();

    if (tree[next] == null) {
      tree[next] = {
        'items': {},
        'identifier': next, // abstract value in the data
        'label': dataProvider.getLabel(dimensionName, currentLevel, next), // h-readable value
        // 'dimension': dimensionsData[dimensionName],
        'children': {}, // child categories in hierarchical dimension
      };
    }

    tree[next].items[item[itemID]] = item; // add reference to item

    const rest = categoryList.slice(1, categoryList.length);
    if (rest.length > 0) {
      const childNodes = tree[next].children;
      recurseHierarchy(childNodes, tree[next], rest, item, dimensionName, currentLevel + 1);
    }
  };

  /**
   * Creates the hierarchy between all categories in all dimensions. On every level, the list of
   * items that have this category is stored. This allows quick lookups for complex queries later
   * on. To be called after item/schema data has changed.
   * dimensionA -> category1 -> { category11, category12, category13 } -> ...
   * TODO: PERFORMANCE PROBLEM LOADING APPLICATION WITH 100k ITEMS
   * @return  {void}
   */
  converter.buildHierarchy = function() {

    let values; // category names in hierarchical dimensions
    const itemID = dataProvider.itemID();
    const itemValue = dataProvider.itemValue();

    Object.keys(dimensionsData).forEach((name) => {
      categoryTree[name] = {};
    });

    itemList.forEach((item) => {
      // set hierarchical attributes according to the schema
      dataProvider.expandHierarchies(item);
      // add timestamp values to the item
      dataProvider.addAggregateDimensions(item);

      Object.keys(item).forEach((dim) => {
        if (dim === itemValue || dim === itemID) return;
        if (dim === 'active') return;
        if (dim === 'aggregateDimensions') return;
        if (dim === 'uncertainty') return;

        // check if dimension is hierarchical and treat it accordingly
        if (typeof item[dim] === 'object') {
          // call the recursion with an initial list of all values for this item. This list of
          // values is then shrunk in size by one each recursion step
          values = Object.values(item[dim]);
          recurseHierarchy(categoryTree[dim], null, values, item, dim, 0);
        } else {
          if (categoryTree[dim][item[dim]] == null) {
            categoryTree[dim][item[dim]] = {
              'items': {},
              'identifier': item[dim],
              'label': dataProvider.getLabel(dim, 0, item[dim]),
              'children': null,
            };
          }

          // add reference to this item to this category inside this flat dimension
          categoryTree[dim][item[dim]].items[item[itemID]] = item;
        }
      });
    });

    Object.keys(categoryTree).forEach((dim) => {
      dimensionsData[dim].categoryTree = categoryTree[dim];
    });
  };

  /**
   * Given a name of a dimension, this will use the categoryTree to get a list of all
   * categories that match it's active query. A query is a tree of categories clicked to reach a
   * certain level in the hierarchy.
   * @param   {object}  dimension a dimension object
   * @param   {object}  query     a query for this dimension. Empty query is default.
   * @return  {object}            list of categories that match the query for the given dimension
   */
  converter.getCategories = function(dimension, query = []) {
    if (dimension == null) throw Error('parallelHierarchies: no dimension provided');
    if (categoryTree[dimension.name] == null) throw Error('parallelHierarchies: dimension not found');

    let node = categoryTree[dimension.name];
    const categories = [];

    // go through the categorytree filter by filter to get the last element
    (function traverseTree(tree, filters) {
      if (filters.length > 0) {
        node = tree[filters[0]].children;
        traverseTree(node, filters.slice(1, filters.length));
      }
    }(node, query));

    // get the elements from the categoryTree and add them to the categories array
    Object.keys(node).forEach((value) => {
      categories.push(node[value]);
    });

    return categories;
  };

  converter.createDimensions = function(schema) {

    const dimensionNames = schema.dimensions;

    let nextDim; // next new dimension added to the dimensionsdata

    for (let i = 0; i < dimensionNames.length; i++) {
      const hierarchy = schema.hierarchies.find(h => h.label === dimensionNames[i]);
      nextDim = {
        'name': dimensionNames[i],
        'color': null, // iconic color for this dimension
        'queryTree': {},
        'queryList': [],
        'active': [], // list of active instances in the visualization
        'numerical': schema.numerical.indexOf(dimensionNames[i]) > -1,
        'levels': hierarchy == null ? [] : hierarchy.levels, // identifieres of category levels
        'categoryTree': {}, // list of categories for this dimension
      };

      nextDim.color = getColorPreset(dimensionNames[i]);
      if (nextDim.color === null) nextDim.color = color(dimensionNames[i]);

      dimensionsData[dimensionNames[i]] = nextDim;
    }

    setInitiallyActiveDimensionStatus();
  };

  let setInitiallyActiveDimensionStatus = function() {

    let activeIndex = 0; // horizontal position that is given to the next active dimension

    Object.values(dimensionsData).forEach((nextDim, i) => {
      if (initialDimensions.length < 2) {
        if (i < 2) nextDim.active.push(activeIndex++);
      } else if (initialDimensions.includes(nextDim.name)) {
        nextDim.active.push(activeIndex++);
      }
    });
  };

  let getColorPreset = function(dimensionName) {
    let preset = null;

    if (dimensionName === 'Cellular Comonent') preset = '#77AADD';
    else if (dimensionName === 'Biological Process') preset = '#ddaa77';
    else if (dimensionName === 'Molecular Function') preset = '#77cccc';
    else if (dimensionName === 'Chromosome') preset = '#dddd77';
    else if (dimensionName === 'Gene') preset = '#88ccaa';

    if (dimensionName === 'Cost Item') preset = '#77aadd';
    else if (dimensionName === 'Component Split') preset = '#88ccaa';
    else if (dimensionName === 'Price') preset = '#dddd77';
    else if (dimensionName === 'Price Ranges') preset = '#dd7788';
    else if (dimensionName === 'Location') preset = '#77cccc';

    if (dimensionName === 'Age') preset = '#88ccaa';
    else if (dimensionName === 'Sex') preset = '#77aadd';
    else if (dimensionName === 'Experience') preset = '#dd7788';
    else if (dimensionName === 'Roles') preset = '#ddaa77';

    if (dimensionName === 'POB') preset = '#dddd77';
    else if (dimensionName === 'INDUSTRY') preset = '#ddaa77';
    else if (dimensionName === 'OCCUP') preset = '#88ccaa';
    else if (dimensionName === 'AGE') preset = '#cc99bb';
    else if (dimensionName === 'SEX') preset = '#dd7788';
    else if (dimensionName === 'ANCESTRY 1') preset = '#77aadd';
    else if (dimensionName === 'ANCESTRY 2') preset = '#77cccc';
    else if (dimensionName === 'LANGUAGE') preset = '#9B62A7 ';

    return preset;
  };

  // GETTERS AND SETTERS ///////////////////////////////////////////////////////////////////////////

  converter.dimensionsData = function(_) {
    if (!arguments.length) return dimensionsData;
    dimensionsData = _;
    return converter;
  };

  converter.initialDimensions = function(_) {
    if (!arguments.length) return initialDimensions;
    initialDimensions = _;
    return converter;
  };

  converter.itemList = function(_) {
    if (!arguments.length) return itemList;
    itemList = _;
    return converter;
  };

  converter.dataProvider = function(_) {
    if (!arguments.length) return dataProvider;
    dataProvider = _;
    return converter;
  };

  converter.hierarchies = function(_) {
    if (!arguments.length) return hierarchies;
    hierarchies = _;
    return converter;
  };

  converter.color = function(_) {
    if (!arguments.length) return color;
    color = _;
    return converter;
  };

  return converter;
};

export default DataConverter;