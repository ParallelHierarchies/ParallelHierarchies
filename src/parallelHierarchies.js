let parallelHierarchies = function() {

  let itemList = []; // list of items loaded and preprocessed by dataprovider
  const dimensionsData = {}; // metadata for dimensions (name, categories, query, active)
  let ribbonData = [];

  let adjacency = [];

  let categoryTree = {}; // category hierarchy per dimension with list of items per category

  let dataProvider; // loads the data and allows access to data
  let ui; // interface controller
  let intersectionOptimizer; // minimizes intersections between ribbons

  let itemValue; // identifier for value of single items
  let itemID; // unique identifier for single items
  let value; // function that returns the value to an item at a given timestamp
  let initialDimensions = []; // list of dimensions to be displayed when app starts

  const observedDimensions = []; // list of dimension generators waiting for changes
  const observedRibbons = []; // list of ribbon generators waiting for changes

  const scaleX = d3.scaleLinear(); // scale for horizontal positioning
  const scaleY = d3.scaleLinear(); // scale for vertical positioning

  const defaultColors = ['steelblue']; // default color set only includes one color
  let color = d3.scaleOrdinal(); // scale used to color dimensions

  let timestamps = [];

  const duration = 300;
  // const easing = d3.easeElastic;
  const easing = d3.easePolyOut;

  const fisheye = d3.fisheye.circular().radius(200).distortion(6);
  let useCategoryFisheye = false;
  let useCategoryDragging = !useCategoryFisheye;
  let useIntersectionMinimization = true;
  let useGreedyMinimization = false;

  let isDraggingActive = false;

  // D3 SELECTIONS
  let svgContainer; // <svg> selection the parallelHiearchies are drawn onto
  let root; // <g> selection that every child-component of the visualization is attached to
  let dimensions; // <g> selection that contains all dimensions
  let ribbons;

  // SVG configuration
  let width = 1600; // maximum horizontal space of visualization
  let height = 900; // maximum vertical space of visualization
  let margin = { 'left': 125, 'top': 100, 'right': 125, 'bottom': 100 };
  let dimensionHeaderPadding = 150;

  let percentageBarGenerator;

  let pendingTimeouts = [];

  let hierarchies = function(selection) {
    if (dataProvider == null) throw Error('parallelHierarchies: dataProvider not set');
    if (initialDimensions.length === 1) {
      throw Error('parallelHierarchies: provide at least two initial dimensions or none');
    }

    itemValue = dataProvider.itemValue();
    itemID = dataProvider.itemID();
    value = dataProvider.getValue;

    intersectionOptimizer = parallelHierarchies.intersectionOptimizer();

    // save container that called the hierarchies
    svgContainer = selection;

    dataProvider.loadData().then(function(result) {
      itemList = result.itemList;
      itemList.forEach(function(item) { item.active = true });

      // the first element in theitemlist can be used to get a list of all dimensions, because every
      // item contains at least one level per hierarchical dimension
      let keys = result.schema.dimensions;

      let categories;
      let nextDim; // next new dimension added to the dimensionsdata
      let activeIndex = 0;

      // use list of dimension names as default color domain and defaultColors for its range
      if (color.domain().length === 0) color.domain(keys);
      if (color.range().length === 0) color.range(defaultColors);

      for (let i = 0; i < keys.length; i++) {
        let hierarchy = result.schema.hierarchies.find(function(h) { return h.label === keys[i] });
        nextDim = {
          'name': keys[i],
          'color': color(keys[i]), // iconic color for this dimension
          'query': [], // currently selected terms in the hierarchy
          'active': [], // list of active instances in the visualization
          'numerical': result.schema.numerical.indexOf(keys[i]) > -1,
          'levels': hierarchy == null ? [] : hierarchy.levels, // identifieres of category levels
          'categories': [] // list of categories for this dimension
        };

        if (keys[i] === 'POB') nextDim.color = '#dddd77';
        else if (keys[i] === 'INDUSTRY') nextDim.color = '#ddaa77';
        else if (keys[i] === 'OCCUP') nextDim.color = '#88ccaa';
        else if (keys[i] === 'AGE') nextDim.color = '#cc99bb';
        else if (keys[i] === 'SEX') nextDim.color = '#dd7788';
        else if (keys[i] === 'ANCESTRY 1') nextDim.color = '#77aadd';
        else if (keys[i] === 'ANCESTRY 2') nextDim.color = '#77cccc';
        else if (keys[i] === 'LANGUAGE') nextDim.color = '#9B62A7 ';

        dimensionsData[keys[i]] = nextDim;

        // if no initial dimension were provided, 'activate' the first two in keys, otherwise set
        // only the provided ones to active
        if (initialDimensions.length < 2)  {
          if (i < 2) {
            nextDim.active.push(activeIndex++);
          }
        } else {
          if (initialDimensions.includes(keys[i])) {
            nextDim.active.push(activeIndex++);
          }
        }
      }

      // generate the hierarchy between categories
      buildCategoryTree();

      let maxDepth = 0;
      let maxDepthCat = null;
      for (let dim in result.schema.hierarchies) {
        if (result.schema.hierarchies[dim].levels.length > maxDepth) {
          maxDepth = result.schema.hierarchies[dim].levels.length;
          maxDepthCat = result.schema.hierarchies[dim].label;
        }
      }

      console.log('maximum hierarchy depth:', {maxDepth, maxDepthCat});
      console.log('maximum width', getMaxWidth())

      // add references to category nodes on the first level from the categorytree to the dimensions
      for (let name in dimensionsData) {
        dimensionsData[name].categories = hierarchies.getCategories(dimensionsData[name])
      }

      // initialize scales for positioning and length calculations
      scaleX
        .domain([0, initialDimensions.length > 1 ? initialDimensions.length - 1 : 1])
        .range([margin.left, width - margin.right]);

      scaleY
        .domain([0, hierarchies.getItemValueSum(itemList)])
        .range([0, height - margin.top - margin.bottom - dimensionHeaderPadding]);

      draw();
    });
  };

  /**
   * Creates the hierarchy between all categories in all dimensions. On every level, the list of
   * items that have this category is stored. This allows quick lookups for complex queries later
   * on. To be called after item/schema data has changed.
   * dimensionA -> category1 -> { category11, category12, category13 } -> ...
   * @return  {void}
   */
  let buildCategoryTree = function() {
    for (let name in dimensionsData) categoryTree[name] = {};

    // helper function to traverse the categoryTree recursively and insert items on every level
    // is called for every hierarchical dimension per item
    function recurseHierarchy(tree, categoryList, item, dimensionName, currentLevel) {
      let next = categoryList[0]; // next category name in list

      if (tree[next] == null) {
        tree[next] = {
          'items': {},
          'identifier': next, // abstract value in the data
          'label': dataProvider.getLabel(dimensionName, currentLevel, next), // h-readable value
          'dimension': dimensionsData[dimensionName],
          'level': currentLevel,
          'children': {} // child categories in hierarchical dimension
        };
      }

      tree[next].items[item[itemID]] = item; // add reference to item

      let rest = categoryList.slice(1, categoryList.length);
      if (rest.length > 0) recurseHierarchy(tree[next].children, rest, item, dimensionName, currentLevel+1);
    };

    let values; // category names in hierarchical dimensions
    let node; // node in category tree
    let item;

    itemList.forEach(function(item) {
      // set hierarchical attributes according to the schema
      dataProvider.expandHierarchies(item);
      // add timestamp values to the item
      dataProvider.addTimestamps(item);

      for (let dim in item) {
        if (dim === itemValue || dim === itemID) continue;
        if (dim === 'active') continue;
        if (dim === 'timestamps') continue;

        // check if dimension is hierarchical and treat it accordingly
        if (typeof item[dim] === 'object') {
          // call the recursion with an initial list of all values for this item. This list of
          // values is then shrunk in size by one each recursion step
          values = Object.values(item[dim]);
          recurseHierarchy(categoryTree[dim], values, item, dim, 0);
        } else {
          if (categoryTree[dim][item[dim]] == null) {
            categoryTree[dim][item[dim]] = {
              'items': {},
              'identifier': item[dim],
              'label': dataProvider.getLabel(dim, 0, item[dim]),
              'dimension': dimensionsData[dim]
            };
          }

          // add reference to this item to this category inside this flat dimension
          categoryTree[dim][item[dim]].items[item[itemID]] = item;
        }
      }
    });
  };

  /**
   * Draws all SVG components. Starts by drawing dimensions, which then draw categories. Then adds
   * ribbons.
   * @return  {void}
   */
  let draw = function() {

    svgContainer.on('mousemove', function() {
      if (useCategoryFisheye) {
        const focusPoint = d3.mouse(this);
        focusPoint[1] -= 0;
        fisheye.focus(focusPoint);
        observedDimensions.forEach(function(dim) { dim.fisheye(fisheye) });
        observedRibbons.forEach(function(rib) { rib.update() });
      }
    });

    svgContainer.selectAll('.parallelHierarchies').remove();
    root = svgContainer.append('g').attr('class', 'parallelHierarchies');

    // add ribbons' <g> before dimensions' so that dimensions are drawn ontop of ribbons but ribbons
    // can still use the data for dimensions and categories
    ribbons = root.append('g')
      .attr('class', 'ribbons')
      .attr('transform', 'translate(0, '+(dimensionHeaderPadding)+')');

    dimensions = root.append('g').attr('class', 'dimensions');

    drawDimensions();

    // derive the ribbons from the active dimensions and draw them
    updateRibbonData();
    drawRibbons();
    updateRibbons({ changed: null });

    drawPercentageBars();
  };

  hierarchies.onResize = function() {
    scaleX.range([margin.left, width - margin.right]);
    scaleY.range([0, height - margin.top - margin.bottom - dimensionHeaderPadding]);
    draw();
  };

  /**
   * Categories represent the possible values of a dimension. The bigger the category visually, the
   * more items contain this value for that dimesion.
   * In this function, the category generator is called on a <g> for every possible category.
   * @return {void}
   */
  let drawDimensions = function() {
    let sortedDimensions = getSortedActiveDimensions();
    observedDimensions.length = 0;

    // call the parallelHierarchies.dimension generator on every dimension group. This module will
    // then add the visual components and interactions.
    sortedDimensions.forEach(function(d, i) {
      let dim = parallelHierarchies.dimension()
        .data(d)
        .index(i)
        .isFirst(i === 0)
        .isLast(i === sortedDimensions.length - 1)
        .x(scaleX(i))
        .y(0)
        .height(height - margin.top - margin.bottom)
        .headerPadding(dimensionHeaderPadding)
        .scaleY(scaleY)
        .dataProvider(dataProvider)
        .defaultOrder(useIntersectionMinimization ? 'minimize' : 'desc')
        .subscribe(hierarchies);

      observedDimensions.push(dim);
    });

    dimension = dimensions.selectAll('.dimension').data(observedDimensions).enter()
      .append('g')
        .attr('class', 'dimension grabbable')
        .each(function(d) {
          d3.select(this)
            .attr('transform', 'translate('+d.x()+','+d.y()+')')
            .call(d);
          });

    // add drag behaviour to dimensions: dimensions can be dragged vertically. They snap in place
    // on dragend.
    dimension.call(dimensionDrag);
  };

  /**
   * Ribbons are links between categories of neighboring dimensions. Their height indicates the
   * percentage of elements in the dataset, that contain both the start and end category in their
   * respective categories.
   * @return {void}
   */
  let drawRibbons = function() {
    observedRibbons.length = 0;

    ribbons.selectAll('.ribbon').remove();
    let ribbonList = [];
    ribbonData.forEach(function(r) { ribbonList = ribbonList.concat(r) });

    ribbonList.forEach(function(d) {
      let rib = parallelHierarchies.ribbon()
        .scaleY(scaleY)
        .height(d.height)
        .data(d)
        .offset({'source': d.sourceOffset, 'target': d.targetOffset})
        .subscribe(hierarchies);

      rib.source = d.source;
      rib.target = d.target;

      observedRibbons.push(rib); // save reference to generator
    });

    ribbon = ribbons.selectAll('.ribbon').data(observedRibbons).enter()
      .append('g')
        .attr('class', 'ribbon')
        .each(function(rib) { d3.select(this).call(rib) });
  };

  let drawPercentageBars = function() {
    let dimensionEntries = {};
    let allItemValueSum = hierarchies.getGlobalItemSum(itemList);
    let activeItemValueSum = hierarchies.getItemValueSum(itemList);

    observedDimensions.forEach((dim) => {
      let dimensionItems = [];
      dim.data().categories.forEach((cat) => {
        Object.values(cat.items).forEach(item => dimensionItems.push(item));
      });

      let dimensionValue = hierarchies.getGlobalItemSum(dimensionItems);

      dimensionEntries[dim.data().name] = {
        value: dimensionValue,
        color: dim.data().color
      };
    });

    if (percentageBarGenerator === undefined) {
      percentageBarGenerator = parallelHierarchies.percentageBars()
        .height(70)
        .max(allItemValueSum)
        .visible(activeItemValueSum)
        .dimensions(dimensionEntries);

      percentageBarSelection.call(percentageBarGenerator);
    } else {
      percentageBarGenerator
        .max(allItemValueSum)
        .visible(activeItemValueSum)
        .dimensions(dimensionEntries)
        .updateView();
    }

  };

  /**
   * Based on the current queries, update the list of visible ribbons.
   * @return {void}
   */
  let updateRibbonData = function() {
    updateAdjancecy();

    minimizeIntersections();

    updatePaths();
  };

  /**
   * Calculates the adjancy matrices between neighboring dimensions
   * @return {void}
   */
  let updateAdjancecy = function() {
    let id = itemID; // cached identifier of items for future use
    let observedLength = observedDimensions.length - 1; // cached number of observed dimensions

    // variables used later on
    let sourceCat;
    let targetCat;
    let sourceDim;
    let targetDim;

    // reset datastructure for paths that is later transformed into the 'ribbondata'
    adjacency.length = 0;

    // go through all items once and add the links between neighboring categories per item. This
    // approach does not require huge lists of items to be intersected, so it should perform better
    // than the category centred way.
    itemList.forEach(function(item) {
      // 'updateActiveItems' guarantees this item to fulfill all queries if it is labelled 'active'
      // ignore other items
      if (!item.active) return;
      // items with no value do not show up as height of ribbons
      if (+value(item) === 0) return;

      // go through all pairs of neighboring dimensions and create new links for the ribbondata
      // on the fly. If the path was already created, simply add a reference to the current item
      // to the link's 'item' list
      for (let i = 0; i < observedLength; i++) {
        sourceDim = observedDimensions[i].data();
        targetDim = observedDimensions[i+1].data();

        sourceCat = item[sourceDim.name];
        targetCat = item[targetDim.name];

        // if the categories are hierarchical, get the value on the lowest level. Since at this
        // point every item MUST confirm to every active query, there is no need to validate
        // preceding query terms
        if (typeof sourceCat === 'object') {
          sourceCat = sourceCat[sourceDim.levels[sourceDim.query.length]];
        }
        if (typeof targetCat === 'object') {
          targetCat = targetCat[targetDim.levels[targetDim.query.length]];
        }

        // initialize each level of the adjacency if it was not yet created
        if (adjacency[i] == null) adjacency[i] = {};
        if (adjacency[i][sourceCat] == null) adjacency[i][sourceCat] = {};
        if (adjacency[i][sourceCat][targetCat] == null) adjacency[i][sourceCat][targetCat] = {
          'height': 0,
          'source': observedDimensions[i].getObservedCategories().find(function(cat) { return cat.data().identifier == sourceCat }),
          'target': observedDimensions[i+1].getObservedCategories().find(function(cat) { return cat.data().identifier == targetCat }),
          'items': {},
          'timestamps': [],
          'targetOffset': 0,
          'sourceOffset': 0
        };

        // add reference to the item itself. The full 'items' property is used later on to calculate
        // heights and offsets
        adjacency[i][sourceCat][targetCat].items[item[id]] = item;
      }
    });
  };

  /**
   * Uses the current adjacency matrices and calculates ribbons connecting the particular categories
   * using the contained items to calculate their heights.
   * @return {void}
   */
  let updatePaths = function() {
    let ribbonHeight = 0;

    // offsets are the vertical shift of ribbon to neighboring ribbons on the same category. There
    // are offsets at the source and target category of each ribbon
    let sourceOffset; // offset of ribbons on source category
    let targetOffsets = []; // offsets of ribbons on target categories per dimension-pair

    ribbonData.length = 0; // reset ribbonData

    // go through the adjacency elementwise and accumulate the items into heights, then use this
    // value for offsets and timestamps and fill out the missing properties
    for (let i = 0; i < adjacency.length; i++) {
      targetOffsets.push({});
      for (let source in adjacency[i]) {
        sourceOffset = 0;
        for (let target in adjacency[i][source]) {

          if (targetOffsets[i][target] == null) {
            targetOffsets[i][target] = 0;
          }

          // array of values for every timestamp in the data
          let sum = hierarchies.getItemValueSum(Object.values(adjacency[i][source][target].items));

          // calculate height of the ribbon by adding up values of shared items
          if (timestamps.length === 0 || timestamps[0] === timestamps[1]) {
            ribbonHeight = scaleY(sum);
          } else {
            ribbonHeight = scaleY(sum[0] + sum[1]);
          }

          sourceOffset += ribbonHeight / 2;
          targetOffsets[i][target] += ribbonHeight / 2;

          // set the missing values in the adjacency
          adjacency[i][source][target].height = ribbonHeight;
          adjacency[i][source][target].timestamps = sum;
          adjacency[i][source][target].level = i;
          adjacency[i][source][target].sourceOffset = sourceOffset;
          adjacency[i][source][target].targetOffset = targetOffsets[i][target];

          // add the full object to the ribbondata
          ribbonData.push(adjacency[i][source][target]);

          sourceOffset += ribbonHeight / 2;
          targetOffsets[i][target] += ribbonHeight / 2;
        }
      }
    }
  };

  /**
   * Using the optimized order of categories, update the position of ribbons and categories
   * accordingly to reduce clutter between dimensions and increase readability.
   * @return {void}
   */
  let minimizeIntersections = function() {
    let minimized = intersectionOptimizer.barycentricMethod(adjacency, useGreedyMinimization);
    observedDimensions.forEach(function(dim, i) {
      dim.minimizeIntersections(minimized[i]);
    });

    // reorder the adjacency according to the minimzation order. This will cause ribbons to be drawn
    // in the minimized order as well, reducing per-category intersections.
    let minimizedAdjacency = [];

    adjacency.forEach(function(matrix, i) {
      minimizedAdjacency.push({});

      // create temporary array-duplicate for this matrix to allow sorting
      let tempSource = [];
      for (let sourceCat in matrix) {
        let tempTarget = [];
        let targets = {};

        for (let targetCat in matrix[sourceCat]) {
          tempTarget.push({
            'data': matrix[sourceCat][targetCat],
            'label': targetCat,
            'index': minimized[i+1][targetCat]
          });
        }

        tempTarget.sort(function(a, b) { return a.index - b.index });
        tempTarget.forEach(function(t) {
          targets[t.label] = t.data;
        });

        tempSource.push({
          'data': targets,
          'label': sourceCat,
          'index': minimized[i][sourceCat]
        });
      }

      tempSource.sort(function(a, b) { return a.index - b.index });
      tempSource.forEach(function(t) {
        minimizedAdjacency[i][t.label] = t.data
      });
    });

    // set adjacency to the version with sorted categories
    adjacency = minimizedAdjacency;
  }

  /**
   * Update the ribbons when a category is dragged.
   * @param {object} message identifies the dragged category by dimension and and excluded category
   */
  let updateRibbons = function(message) {

    // using the order of categories from the observed dimensions, update the source and target
    // offsets of the observed ribbons
    let orderings = observedDimensions.map(function(dim) { return dim.getCategoryOrder() });

    // category identifieres
    let sourceLabel;
    let targetLabel;
    let lvl;

    // stores all observed dimensions in a sourceLabel -> targetLabel mapping for quick lookup
    let ribbonDict = {};

    let sourceOffset; // offset of ribbons on source category
    let targetOffsets = []; // offsets of ribbons on target categories per dimension-pair

    observedRibbons.forEach(function(rib) {
      sourceLabel = rib.data().source.data().identifier;
      targetLabel = rib.data().target.data().identifier;
      lvl = rib.data().level;

      if (ribbonDict[lvl] == null) ribbonDict[lvl] = {};
      if (ribbonDict[lvl][sourceLabel] == null) ribbonDict[lvl][sourceLabel] = {};
      if (ribbonDict[lvl][sourceLabel][targetLabel] == null) ribbonDict[lvl][sourceLabel][targetLabel] = rib;
    });

    // update the source and target offsets of all ribbons. This is quite an expansive step but
    // makes the overall appearance more logical, because the order of ribbons corresponds the order
    // of both connected dimensions.
    // the procedure is the same as in 'updatePaths()', using only the offset calculation parts.
    for (let i = 0; i < orderings.length - 1 && (message.changed == null || message.changed.length > 1); i++) {
      targetOffsets.push({});
      for (let s = 0; s < orderings[i].length; s++) {
        sourceOffset = 0;
        sourceLabel = orderings[i][s].label;

        targetLoop: for (let t = 0; t < orderings[i + 1].length; t++) {

          targetLabel = orderings[i+1][t].label;

          if (targetOffsets[i][targetLabel] == null) {
            targetOffsets[i][targetLabel] = 0;
          }

          // array of values for every timestamp in the data
          if (ribbonDict[i][sourceLabel][targetLabel] == null) continue targetLoop;

          let ribbonHeight = ribbonDict[i][sourceLabel][targetLabel].height();

          sourceOffset += ribbonHeight / 2;
          targetOffsets[i][targetLabel] += ribbonHeight / 2;

          ribbonDict[i][sourceLabel][targetLabel].offset({
            'source': sourceOffset,
            'target': targetOffsets[i][targetLabel]
          });

          sourceOffset += ribbonHeight / 2;
          targetOffsets[i][targetLabel] += ribbonHeight / 2;
        }
      }
    }

    // message contains category data. Find all ribbons connected to this category and update
    // them, using the same transition as the categories to get a smooth, synchronized appearance
    observedRibbons
      .filter(function(rib) {
        if (message.changed == null) return true;
        return message.changed.indexOf(rib.source) > -1 || message.changed.indexOf(rib.target) > -1;
      })
      .forEach(function(rib) {
        if (message.noTransition == null) rib.update(true);
        else rib.update(message.noTransition !== rib.source && message.noTransition !== rib.target);
      });
  };

  /**
   * Given a clicked-on category, update all instances of the containing dimension according to the
   * new query.
   * @param {object} message
   */
  let updateDimensions = function(message) {
    if (message == null) {
      throw Error('parallelHierarchies: provided message must not be null nor undefined');
    } else if (message.dimension == null) {
      throw Error('parallelHierarchies: message must contain "dimension" property');
    }

    let changedDimension = message.dimension;

    changedDimension.categories = hierarchies.getCategories(changedDimension);

    updateActiveItems();

    scaleY.domain([0, timestamps[0] !== timestamps[1]
      ? parseInt(d3.sum(hierarchies.getItemValueSum(itemList)))
      : parseInt(hierarchies.getItemValueSum(itemList))]);

    observedDimensions.forEach(function(dim) { dim.update(true) });

    updateRibbonData();
    drawRibbons();
    updateRibbons({ changed: null, noTransition: null });

    drawPercentageBars();
  };

  /**
   * Every dimension has an independent query and therefore a unique list of represented items. This
   * will get the list of items that are active for every active query.
   * @return  {void}
   */
  let updateActiveItems = function() {
    let activeItems = {};
    let id = itemID;

    itemList.forEach(function(item) {
      item.active = false;
      activeItems[item[id]] = item;
    });

    let dimItems;
    let dim;

    // intersect the list of items active per dimension with the total list of items to get a list
    // of items that are active in every dimension
    for (let name in dimensionsData) {
      dim = dimensionsData[name];

      // check every dimensions only once and don't consider inactive dimensions
      if (dim.active.length === 0) continue;
      // dimensions without any active query terms will not change the activeitems list
      if (dim.query.length === 0) continue;

      dimItems = {};

      // get a list of all active items in this dimension. Since an item can only appear in one
      // category, dimItems contains no duplicates
      dim.categories.forEach(function(cat) {
        for (let identifier in cat.items) dimItems[identifier] = cat.items[identifier];
      });

      // intersect both lists: find all items in activeitems that are not part of dimitems
      for (let identifier in activeItems) {
        if (dimItems[identifier] == null) delete activeItems[identifier];
      }
    }

    // set all active items to 'active' to reflect in the data that they match every active query
    for (let identifier in activeItems) activeItems[identifier].active = true;
  };

  /**
   * Adds a new dimension to the parallelHierarchies.
   * @param  {}     message
   * @return {void}
   */
  let addDimension = function(message) {
    // make sure given dimension is valid by finding it in the list of available dimensions
    let newDim = dimensionsData[message.name];
    if (newDim == null) throw Error('parallelHierarchies: new dimension not found');

    newDim.active.push(observedDimensions.length);

    // update horizontal scale
    scaleX.domain([0, observedDimensions.length]);

    // update vertical scale
    scaleY.domain([0, hierarchies.getItemValueSum(itemList)]);

    draw();
  };

  /**
   * Removes a given dimension generator from parallelHierarchies.
   * @param  {}     message
   * @return {void}
   */
  let removeDimension = function(message) {
    if (observedDimensions.length <= 2) {
      throw Error("parallelHierarchies: keep at least two dimensions");
    }

    let visualIndex = observedDimensions.indexOf(message.dimension);
    let indexInObj = message.dimension.data().active.indexOf(visualIndex);

    // remove reference to the deleted dimension from the set of generators
    observedDimensions.splice(visualIndex, 1);
    // remove 'acitve' listing in the dimensionsData
    message.dimension.data().active.splice(indexInObj, 1);

    let dim;
    for (let name in dimensionsData) {
      dim = dimensionsData[name];
      for (let a = 0; a < dim.active.length; a++) {
        if (dim.active[a] > visualIndex) dim.active[a]--;
      }
    }

    // update horizontal scale
    scaleX.domain([0, observedDimensions.length - 1]);

    // update vertical scale
    scaleY.domain([0, hierarchies.getItemValueSum(itemList)]);

    // redraw all elements
    draw();
  };

  /**
   * On mouse over events, highlight every category and ribbon that shares items with the category
   * which emitted the mouse-over event.
   * @param   {object} message message from hovered category
   * @return  {void}
   */
  let highlight = function(message) {
    // send highlighting message to all ribbons and dimensions; vary the calls based on the message
    // received by the highlighted element
    pendingTimeouts.forEach(clearTimeout);
    pendingTimeouts.length = 0;
    if (isDraggingActive) return;

    pendingTimeouts.push(setTimeout(() => {
      if (message == null) {
        observedDimensions.forEach(function(dim) { dim.highlight(null) });
        observedRibbons.forEach(function(rib) { rib.highlight(null) });
      } else if (message.category != null) {
        observedDimensions.forEach(function(dim) {
          dim.highlight(message.category.data().items);
        });
        observedRibbons.forEach(function(rib) {
          rib.highlight(message.category.data().items);
        });
      } else if (message.ribbon != null) {
        observedDimensions.forEach(function(dim) {
          dim.highlight(message.ribbon.items);
        });
        observedRibbons.forEach(function(rib) {
          rib.highlight(message.ribbon.items);
        });
      }
    }), 0);

    let total = timestamps[0] !== timestamps[1]
    ? parseInt(d3.max(hierarchies.getItemValueSum(itemList)))
    : parseInt(hierarchies.getItemValueSum(itemList));

    let globalTotal = timestamps[0] !== timestamps[1]
    ? parseInt(d3.max(hierarchies.getGlobalItemSum(itemList)))
    : parseInt(hierarchies.getGlobalItemSum(itemList));

    // show tooltip textualizing the highlighted items; vary again on the type of received message
    if (message === null) {
      ui.hideTooltip();
    } else if (message.category != null) {
      let absolute = timestamps[0] !== timestamps[1]
      ? parseInt(d3.max(hierarchies.getItemValueSum(Object.values(message.category.data().items))))
      : parseInt(hierarchies.getItemValueSum(Object.values(message.category.data().items)));

      let relative = parseInt(absolute / total * 10000) / 100 + '%';
      // let text = absolute + dataProvider.getSchema().unit + '  ' + relative + '%';
      let global = parseInt(absolute / globalTotal * 10000000) / 100000 + '%';

      // separate groups of 1000s by ',' for better readability of large numbers
      absolute = (absolute + "").split("").reverse().join("");
      absolute = absolute.replace(/(.{3})/g,"$1,");
      absolute = absolute.split("").reverse().join("");
      absolute = absolute.replace(/^,/, ''); // removes heading ,

      let body = { 'absolute value': absolute, '% of visible': relative, '% of all': global };

      ui.showTooltip(message.category.data().label, body, message.event);
    } else if (message.sibling != null) {
      ui.showTooltip(message.sibling, '', message.event);
    } else if (message.ribbon != null) {
      let sourceLabel = message.ribbon.source.data().label;
      let targetLabel = message.ribbon.target.data().label;

      let absolute = timestamps[0] !== timestamps[1]
      ? parseInt(d3.max(hierarchies.getItemValueSum(Object.values(message.ribbon.items))) * 100) / 100
      : parseInt(hierarchies.getItemValueSum(Object.values(message.ribbon.items)) * 100) / 100;

      let relative = parseInt(absolute / total * 10000) / 100 + '%';
      let global = parseInt(absolute / globalTotal * 10000000) / 100000 + '%';

      // separate groups of 1000s by ',' for better readability of large numbers
      absolute = (absolute + "").split("").reverse().join("");
      absolute = absolute.replace(/(.{3})/g,"$1,");
      absolute = absolute.split("").reverse().join("");
      absolute = absolute.replace(/^,/, ''); // removes heading ,

      let body = { 'absolute value': absolute, '% of visible': relative, '% of all': global };

      // ui.showTooltip('', sourceLabel + ' --> ' + targetLabel + ' (' + value + dataProvider.getSchema().unit +  ')', message.event);
      ui.showTooltip(sourceLabel + ' → ' + targetLabel, body, message.event);
    }
  };

  /**
   * Returns a list of dimensions (duplicates possible) that are currently active sorted by their
   * positions in the active property
   * @return  {object}  list of active dimensions sorted by their index
   */
  let getSortedActiveDimensions = function() {
    if (Object.keys(dimensionsData).length === 0) throw Error('parallelHierarchies: no dimensions found');

    // get all dimensions that are currently active
    let activeDimensions = [];
    for (let name in dimensionsData) {
      if (dimensionsData[name].active.length > 0) activeDimensions.push(dimensionsData[name]);
    }


    // create a sorted list of dimensions, using their indeces in the active property to set their
    // position
    let sortedDimensions = [];

    activeDimensions.forEach(function(dim) {
      dim.active.forEach(function(index) { sortedDimensions[index] = dim });
    });

    return sortedDimensions.filter(function(d) { return d != null; });
  };

  /**
   * Returns the maximum number of categories in one node of the categoryTree.
   * @return {number} maximum number of categories on any level of the categorytree
   */
  let getMaxWidth = function() {
    if (categoryTree == null) throw new Error('parallelHierarchies: categoryTree not build yet');

    let maxWidth = 0;
    let maxWidthCategory;

    function traverseWidth(node) {
      if (node.children == null) return;
      if (maxWidth < Object.keys(node.children).length) {
        maxWidth = Object.keys(node.children).length;
        maxWidthCategory = node;
      }
      for (let child in node.children) {
        traverseWidth(node.children[child]);
      }
    }

    for (let dim in categoryTree) {
      let cat = { 'children': categoryTree[dim], 'identifier': dim };
      traverseWidth(cat);
    }

    return { maxWidth, maxWidthCategory };
  };

  /**
   * Given a name of a dimension, this will use the categoryDepthTree to get a list of all
   * categories that match it's active query. A query is a list of categories clicked to reach a
   * certain level in the hierarchy (like ['cat3', 'cat31', 'cat316', 'cat3164']).
   * @param   {object}  dimension a dimension object
   * @return  {object}            list of categories that match the query for the given dimension
   */
  hierarchies.getCategories = function(dimension, query) {
    if (dimension == null) throw Error('parallelHierarchies: no dimension provided');
    if (categoryTree[dimension.name] == null) throw Error('parallelHierarchies: dimension not found');

    if (query == null) query = dimension.query;

    let node = categoryTree[dimension.name];
    let categories = [];
    // go through the categorytree filter by filter to get the last element
    (function traverseTree(tree, filters) {
      if (filters.length > 0) {
        node = tree[filters[0]].children;
        traverseTree(node, filters.slice(1, filters.length));
      }
    }(node, query));

    // get the elements from the categoryTree and add them to the categories array
    for (let i in node) {
      categories.push(node[i]);
    }

    return categories;
  };

  /**
   * Treat events dispatched by observed dimensions.
   * @param   {string}  event message from client
   * @return  {void}
   */
  hierarchies.notify = function(event, message) {
    if (arguments.length === 0) throw Error('parallelHierarchies: neither event or message provided');

    if (event === 'categoryPositionChanged') {
      updateRibbons(message);
    } else if (event === 'categoryDragStart') {
      isDraggingActive = true;
    } else if (event === 'categoryDragEnded') {
      isDraggingActive = false;;
    } else if (event === 'categoryExpanded') {
      updateDimensions(message);
    } else if (event === 'categoryCollapsed') {
      updateDimensions(message);
    } else if (event === 'categoryMouseEnter') {
      highlight(message);
    } else if (event === 'categoryMouseOut') {
      highlight(null);
    } else if (event === 'dimensionAdded') {
      addDimension(message);
    } else if (event === 'dimensionRemoved') {
      removeDimension(message);
    } else if (event === 'siblingMouseEnter') {
      highlight(message);
    } else if (event === 'siblingMouseOut') {
      highlight(null);
    } else if (event === 'ribbonMouseEnter') {
      highlight(message);
    } else if (event === 'ribbonMouseMove') {
      ui.moveTooltip(message);
    } else if (event === 'ribbonMouseOut') {
      highlight(null);
    } else {
      throw Error('parallelHierarchies: unknown event type');
    }
  };

  /**
   * Calculates the sum of a given list of items.
   * @param   {object}  items list of items
   * @return  {number}        sum of values of active items in provided list
   */
  hierarchies.getItemValueSum = function(items) {
    if (items == null) throw Error('parallelHierarchies: parameter items must be provided.');

    // if the selected timestamps are not equal, sum up all items for both selected versions.
    // Otherwise return one value
    if (timestamps.length > 0 && timestamps[0] !== timestamps[1]) {
      let v0 = items.reduce(function(a, b) {
        return (b.active) ? +value(b, timestamps[0]) + a : a;
      }, 0);
      let v1 = items.reduce(function(a, b) {
        return (b.active) ? +value(b, timestamps[1]) + a : a;
      }, 0);

      return [v0, v1];
    } else {
      return items.reduce(function(a, b) {
        return (b.active) ? +value(b, timestamps[0]) + a : a;
      }, 0);
    }
  };

  /**
   * Works the same as 'hierarchies.getItemValueSum', but ignnores 'active' state of items.
   * @param   {object}  items list of items
   * @return  {number}        sum of values of items in provided list, independent of 'active' state
   */
  hierarchies.getGlobalItemSum = function(items) {
    if (items == null) throw Error('parallelHierarchies: parameter items must be provided');

        // if the selected timestamps are not equal, sum up all items for both selected versions.
    // Otherwise return one value
    if (timestamps.length > 0 && timestamps[0] !== timestamps[1]) {
      let v0 = items.reduce(function(a, b) {
        return +value(b, timestamps[0]) + a;
      }, 0);
      let v1 = items.reduce(function(a, b) {
        return +value(b, timestamps[1]) + a;
      }, 0);

      return [v0, v1];
    } else {
      return items.reduce(function(a, b) {
        return +value(b, timestamps[0]) + a;
      }, 0);
    }
  };


  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

  hierarchies.dataProvider = function(_) {
    if (!arguments.length) return dataProvider;
    if (typeof _ === 'object') dataProvider = _;
    else throw Error('parallelHierarchies: dataProvider must be an object');
    return hierarchies;
  };

  hierarchies.ui = function(_) {
    if (!arguments.length) return ui;
    if (typeof _ === 'function') ui = _;
    else throw Error('parallelHierarchies: ui must be of type function');
    return hierarchies;
  };

  hierarchies.initialDimensions = function(_) {
    if (!arguments.length) return initialDimensions;
    if (typeof _ === 'object') initialDimensions = _;
    else throw Error('parallelHierarchies: initialDimensions must be an object');
    return hierarchies;
  };

  hierarchies.width = function(_) {
    if (!arguments.length) return width;
    if (typeof _ === 'number') width = _;
    else throw Error('parallelHierarchies: width must be a number');
    return hierarchies;
  };

  hierarchies.height = function(_) {
    if (!arguments.length) return height;
    if (typeof _ === 'number') height = _;
    else throw Error('parallelHierarchies: height must be a number');
    return hierarchies;
  };

  hierarchies.itemValue = function(_) {
    if (!arguments.length) return itemValue;
    if (typeof _ === 'string') itemValue = _;
    else throw Error('parallelHierarchies: itemValue must be a string');
    return hierarchies;
  };

  hierarchies.timestamps = function(_) {
    if (!arguments.length) return timestamps;
    if (typeof _ === 'object' && _.length <= 2) timestamps = _;
    else throw Error('parallelHierarchies: timestamps must be an object');

    // when the timestamp changes, so do the values of every category -> adapt the vertical scale
    if (timestamps[0] === timestamps[1]) {
      scaleY.domain([0, hierarchies.getItemValueSum(itemList)]);
    } else {
      let timestampSums = hierarchies.getItemValueSum(itemList);
      scaleY.domain([0, timestampSums[0] + timestampSums[1]]);
    }

    draw();
    return hierarchies;
  };

  hierarchies.percentageBarSelection = function(_) {
    if (!arguments.length) return percentageBarSelection;
    if (typeof _ === 'object') percentageBarSelection = _;
    else throw Error('parallelHierarchies: percentageBarSelection must be of type object');
    return hierarchies;
  };

  hierarchies.color = function(_) {
    if (!arguments.length) return color;
    if (typeof _ === 'function') color = _;
    else throw Error('parallelHierarchies: color must be of type function');
    return hierarchies;
  };

  hierarchies.useCategoryDragging = function(_) {
    if (!arguments.length) return useCategoryDragging;
    if (typeof _ === 'boolean') useCategoryDragging = _;
    else throw Error('parallelHierarchies: useCategoryDragging must be of type boolean');
    return hierarchies;
  };

  hierarchies.useCategoryFisheye = function(_) {
    if (!arguments.length) return useCategoryFisheye;
    if (typeof _ === 'boolean') useCategoryFisheye = _;
    else throw Error('parallelHierarchies: useCategoryFisheye must be of type boolean');
    if (!useCategoryFisheye) {
      observedDimensions.forEach(function(dim) { dim.fisheye(null) });
      observedRibbons.forEach(function(rib) { rib.update() });
    }
    return hierarchies;
  };

  hierarchies.useIntersectionMinimization = function(_) {
    if (!arguments.length) return useIntersectionMinimization;
    if (typeof _ === 'boolean') {
      useIntersectionMinimization = _;
      draw();
      updateRibbons({ changed: null, noTransition: null });
    } else {
      throw Error('parallelHierarchies: useIntersectionMinimization must be of type boolean');
    }
    return hierarchies;
  };

  hierarchies.useGreedyMinimization = function(_) {
    if (!arguments.length) return useGreedyMinimization;
    if (typeof _ === 'boolean') {
      useGreedyMinimization = _;
      if (useIntersectionMinimization) {
        // updateRibbons({ changed: null, noTransition: null });
        draw();
      }
    } else {
      throw Error('parallelHierarchies: useGreedyMinimization must be of type boolean');
    }
    return hierarchies;
  }

  // DRAG BEHAVIORS ////////////////////////////////////////////////////////////////////////////////

  const dimensionDrag = d3.drag()
    .on('start', function(d) {
      d3.select(this).classed('dragging', true);
    })
    .on('drag', function(d) {
      // add mouse delta x to current position of dragged dimension
      d.x(d.x() + d3.event.dx);

      // index of dragged dimension inferred throught the new horizontal position
      const newIndex = Math.max(Math.round(scaleX.invert(d.x())), 0);
      const oldIndex = Math.min(d.index(), observedDimensions.length - 1);

      // if the index changed, find the dimension that was formerly at the new index and swap
      // places, both in the dimensionsData and the dimension generators
      if (oldIndex !== newIndex) {
        let old = observedDimensions[newIndex];
        old.data().active[old.data().active.indexOf(newIndex)] = oldIndex;
        old.index(oldIndex)
        old.isFirst(oldIndex === 0);
        old.isLast(oldIndex === observedDimensions.length - 1);

        d.data().active[d.data().active.indexOf(oldIndex)] = newIndex;
        d.index(newIndex);
        d.isFirst(newIndex === 0);
        d.isLast(newIndex === observedDimensions.length - 1);

        observedDimensions[oldIndex] = old;
        observedDimensions[newIndex] = d;
      }

      // animate the repositioning of dimensions that are not dragged but whose position changed
      dimension.filter(function(dim) {
        return dim.index() !== newIndex && dim.index() !== oldIndex;
      }).transition().duration(duration).ease(d3.easePolyOut)
          .attr('transform', function(dim, i) {
            dim.x(scaleX(dim.index()));
            return 'translate('+dim.x()+','+dim.y()+')';
          });

      // do not anmiate the dragged dimension but keep it right below the cursor
      d3.select(this).attr('transform', 'translate('+d.x()+','+d.y()+')');


      if (oldIndex === newIndex) {
        observedRibbons.forEach(function(rib) { rib.update(false) });
      } else {
        // FIXME: performance of updateRibbonData()
        updateRibbonData([oldIndex, newIndex]);
        drawRibbons();
        observedDimensions.forEach(function(dim) { dim.update(false) });
        drawPercentageBars();
      }
    })
    .on('end', function(d, i) {
      d.x(scaleX(d.index()));

      d3.select(this).transition().duration(duration).ease(easing)
        .attr('transform', 'translate('+d.x()+','+d.y()+')');

      d3.select(this).classed('dragging', false);

      // observedRibbons.forEach(function(rib) { rib.update(true) });
      updateRibbons({ changed: null });
    });

  return hierarchies;
}
