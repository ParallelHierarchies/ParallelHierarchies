import * as d3 from 'd3';

import ValueProvider from '../itemValueProvider';

const DimensionHierarchyController = function() {
  const controller = {};

  let hierarchy;

  let dimension;

  const totalLeafNodePadding = 50;
  const totalVerticalSpace = 100;
  const totalVerticalPadding = totalVerticalSpace * 0.15;
  const totalVerticalHeight = totalVerticalSpace * 0.85;


  /**
   * Draws the svg components representing the hierarchy for this dimension based on the active
   * query.
   * @return {void}
   */
  const createHierarchy = function() {
    // generate a uniform hierarchy from the categorytree using d3.hierarchy (which adds special
    // features like depth and height of tree), then draw a icicle plot representing this hierarchy
    hierarchy = d3.hierarchy(
      { 'value': { 'children': dimension.data().categoryTree } },
      d => d3.entries(d.value.children),
    );

    controller.updateHierarchy();
  };

  controller.updateHierarchy = function() {

    const activeNodes = [];
    hierarchy.each((node) => {
      node.isQueryLeaf = false;
      if (matchesQuery(node)) {
        activeNodes.push(node);
      } else if (matchesQuery(node.parent)) {
        activeNodes.push(node);
      }
    });

    activeNodes.forEach(setIndividualValuesToNode);
    activeNodes.forEach(setActiveAggregateValueToNode);
    activeNodes.forEach(setSiblingsToNode);

    // the nodes are bound to the elements of the categorytree, so only keep values from the
    // hierarchy which are necessary
    activeNodes.forEach((node) => {
      node.data.value.depth = node.depth;
      node.data.value.values = node.values;
      node.data.value.activeAggregateValue = node.activeAggregateValue;
      node.data.value.expandable = node.children !== undefined;
      node.data.value.isQueryLeaf = false;
      node.data.value.node = node;
      // store reference to sibling category data instead of nodes
      node.data.value.siblings = node.siblings.map(d => d.data.value);
    });

    activeNodes.forEach(setQueryPropertiesToNode);
    activeNodes.forEach(setInactiveHeightToNode);
    activeNodes.forEach(setPaddingToNode);

    hierarchy.each((node) => {
      node.heightPerAggregateDimension = {};
      node.h = 0;
    });

    // get one value per aggregate dimension
    dimension.getaggregateDimensions().forEach((name) => {
      hierarchy.each((node) => { node.heightPerAggregateDimension[name] = 0; });
      calculateHeightPerAggregateDimension(hierarchy, name);
    });

    activeNodes.forEach(setHeightToNode);
    activeNodes.forEach(setYPositionToNode);
  };

  controller.updateYPositions = function() {

    const activeNodes = [];
    hierarchy.each((node) => {
      node.isQueryLeaf = false;
      if (matchesQuery(node)) {
        activeNodes.push(node);
      } else if (matchesQuery(node.parent)) {
        activeNodes.push(node);
      }
    });

    activeNodes.forEach(setYPositionToNode);
  };

  /**
   * Sets the 'value' property for a node of the hierarchy using the sum of item values for the
   * category
   * @param   {object} node element of hierarchy
   * @return  {void}
   */
  let setIndividualValuesToNode = function(node) {
    node.values = {};

    dimension.getaggregateDimensions().forEach((name) => {
      if (node.data.value.items === undefined) {
        node.values[name] = 0;
      } else {
        const itemList = Object.values(node.data.value.items);
        node.values[name] = ValueProvider.getActiveItemValueSum(itemList, name);
      }
    });
  };

  let setActiveAggregateValueToNode = function(node) {
    let value = 0;

    if (node.data.value.items !== undefined) {
      const itemList = Object.values(node.data.value.items);
      value = ValueProvider.getActiveItemValueSumForAllAggregates(itemList);
    }

    node.activeAggregateValue = value;
  };

  /**
   * Allows calculation of a visible height of a node for a given aggregate value. This way, one
   * can calculate the height
   * @param   {object} node               element of hierarchy
   * @param   {string} aggregateValue     name of aggregate value property in node as calculated by
   *                                      setValuesToNode()
   * @return  {void}
   */
  let calculateHeightPerAggregateDimension = function(node, aggregateValue) {
    let h = 0;

    // save this information about query leafs for the isDrilledDown state of categories
    node.data.value.isDrilledDown = false;

    // active or inactive?
    if (matchesQuery(node)) {
      // leaf or composite?
      if (isQueryLeaf(node)) {
        // using the same scale for categories as for ribbons
        h = dimension.scaleY()(node.values[aggregateValue]);
        node.data.value.isQueryLeaf = true;
      } else if (node.children === undefined) {
        // matches the query, is not a query leaf and has no child nodes
        h = 0;
      } else {
        // aggregate node that partly matches the query and has child nodes
        node.data.value.isDrilledDown = true;

        // if available, find the active child node in the node's children array
        const activeChildren = node.children
          .filter(child => !isFilteredOutByOtherDimensions(child));
        const activeChildNode = activeChildren
          .find(child => matchesQuery(child));

        // padding is not included in height of children nodes, so add it seperately
        if (activeChildNode !== undefined) {
          if (isQueryLeaf(activeChildNode) && activeChildren.length > 1) {
            h += totalLeafNodePadding;
          } else if (!isQueryLeaf(activeChildNode)) {
            const paddingPerQueryLevel = totalVerticalPadding / dimension.data().queryList.length;
            h += paddingPerQueryLevel;

            // add heights above or below active node if there are no siblings in those positions to
            // ensure diamond shaped dimension hierarchies
            const heightPerQueryLevel = totalVerticalHeight / dimension.data().queryList.length;
            const aboveSiblings = activeChildNode.siblings.filter(isNodeAboveActiveSibling);

            if (aboveSiblings.length === 0) {
              h += heightPerQueryLevel / 2;
            }
            if (aboveSiblings.length === activeChildNode.siblings.length) {
              h += heightPerQueryLevel / 2;
            }
          }
        }

        for (let i = 0; i < node.children.length; i++) {
          h += calculateHeightPerAggregateDimension(node.children[i], aggregateValue);
        }
      }
    } else if (matchesQuery(node.parent)) {
      // set heights of nodes that partly match the query, but are neither leafs nor ancestor of a
      // leaf node
      h = node.inactiveHeightPerChild;
    }

    // do not show leaf nodes that have height 0 to reduce clutter
    if (isFilteredOutByOtherDimensions(node)) {
      h = 0;
    }

    node.heightPerAggregateDimension[aggregateValue] = h;

    return h;
  };

  /**
   * Sets the vertical position of each node in the hierarchy. Calculates both absolute and relative
   * vertical coordinates (y property uses the absoulte value).
   * @param   {object} node element of hierarchy
   * @return  {void}
   */
  let setYPositionToNode = function(node) {
    let absoluteY = 0;
    let relativeY = 0;
    node.yOffset = 0;

    if (node.h === undefined) return;

    if (node === hierarchy) {
      if (dimension.data().queryList.length === 0) {
        absoluteY = 0;
        relativeY = 0;
      } else {
        absoluteY = -totalVerticalSpace / 2;
        relativeY = -totalVerticalSpace / 2;
      }
    } else if (isFilteredOutByOtherDimensions(node)) {
      absoluteY = 0;
      relativeY = 0;
    } else if (matchesQuery(node) && isQueryLeaf(node)) {

      relativeY = node.parent.yOffset;
      absoluteY = relativeY + node.parent.absoluteY;
      node.parent.yOffset += node.h + node.verticalPadding;

    } else if (matchesQuery(node)) {

      relativeY = node.parent.yOffset;
      absoluteY = relativeY + node.parent.absoluteY;
      node.parent.yOffset += node.h;

      const aboveSiblings = node.siblings
        .filter(d => !isFilteredOutByOtherDimensions(d))
        .filter(isNodeAboveActiveSibling);

      // if no siblings are above the active node, still move the block by the required spacing to
      // achieve the diamond shape
      if (aboveSiblings.length === 0) {
        const queryLength = dimension.data().queryList.length;
        const aboveHeightPerQueryLevel = totalVerticalHeight / 2 / queryLength;
        const abovePaddingPerQueryLevel = totalVerticalPadding / 2 / queryLength;

        relativeY += aboveHeightPerQueryLevel + abovePaddingPerQueryLevel;
        absoluteY += aboveHeightPerQueryLevel + abovePaddingPerQueryLevel;
        node.parent.yOffset += aboveHeightPerQueryLevel + abovePaddingPerQueryLevel;
      }

    } else if (matchesQuery(node.parent)) {
      if (isNodeAboveActiveSibling(node)) {
        relativeY = node.parent.yOffset;
        absoluteY = relativeY + node.parent.absoluteY;
        node.parent.yOffset += node.h + node.verticalPadding;
      } else {
        relativeY = node.parent.yOffset + node.verticalPadding;
        absoluteY = relativeY + node.parent.absoluteY;
        node.parent.yOffset += node.h + node.verticalPadding;
      }
    }

    node.relativeY = relativeY;
    node.absoluteY = absoluteY;
    node.y = absoluteY;
  };

  /**
   * Adds up the heights for the active aggregate dimension(s) calculated earlier in
   * calculateHeightPerAggregateDimension() and saves them for each node.
   * @param  {object} node element of hierarchy
   * @return {void}
   */
  let setHeightToNode = function(node) {
    const { primaryAggregateDimension, secondaryAggregateDimension } = ValueProvider;

    let height = node.heightPerAggregateDimension[primaryAggregateDimension];

    if (primaryAggregateDimension !== secondaryAggregateDimension) {
      height += node.heightPerAggregateDimension[secondaryAggregateDimension];
    }

    node.h = height;
  };

  /**
   * Returns the element in the tree that is reached by the provided query. Returns 'undefined' for
   * queries without any result.
   * @param   {array}   queryTree  query tree of dimension
   * @param   {object}  nodePath   a path() to a node in the hierarchy
   * @return  {object}             element of the tree reached by the terms in the list
   */
  const getQueryResult = function(queryTree, nodePath) {
    let nextTerm;
    let element = queryTree;

    // query result for nodes on first level of hierarchy should not be a valid element of the tree
    // if they don't match the query
    if (nodePath.length === 2 && Object.keys(queryTree).length > 0) {
      nextTerm = nodePath[1];
      if (queryTree[nextTerm] == null) return queryTree[nextTerm];
      return queryTree;
    }

    // start with index 1 to skip the first term in path, which is always undefined (root node)
    // end with the previous to last term, because the last term is the name of the node itself and
    // therefore not part of the query to this node
    for (let i = 1; i < nodePath.length - 1 && element !== undefined; i++) {
      nextTerm = nodePath[i];
      element = element[nextTerm];
    }

    return element;
  };

  /**
   * Finds out if a node can be reached by any one of the active queries of this dimension.
   * @param   {object}  node element of the hierarchy
   * @return  {boolean}      whether the element is active in the current queries
   */
  let matchesQuery = function(node) {
    if (node === hierarchy) return true;

    const path = hierarchy.path(node).map(d => d.data.value.identifier);

    const result = getQueryResult(dimension.data().queryTree, path);

    const resultIsUndefined = result === undefined;

    if (resultIsUndefined) return false;

    const isPerfectMatch = Object.keys(result).length === 0;
    const isPartialMatch = !isPerfectMatch && result[node.data.value.identifier] !== undefined;

    return isPerfectMatch || isPartialMatch;
  };

  /**
   * Finds out if the node is a leaf node of the query, meaning that it is a child of the last
   * clicked on category and now a leaf of the dimension's hierarchy.
   * @param   {object}  node element of hierarchy
   * @return  {boolean}      whether the element is a hierarchy leaf in the current queries
   */
  let isQueryLeaf = function(node) {
    // root can never be leaf to query
    if (node === hierarchy) return false;

    const path = hierarchy.path(node).map(d => d.data.value.identifier);

    const result = getQueryResult(dimension.data().queryTree, path);

    if (result === undefined) return false;

    // if the node matches the query, but the result has no properties, it's a leaf to the query
    const isPerfectMatch = Object.keys(result).length === 0;


    return isPerfectMatch;
  };

  let isFilteredOutByOtherDimensions = function(node) {
    return matchesQuery(node) && isQueryLeaf(node) && node.activeAggregateValue === 0;
  };

  /**
   * Sets the 'query' property for the value a node of the hierarchy.
   * @param   {object} node element of hierarchy
   * @return  {void}
   */
  let setQueryPropertiesToNode = function(node) {
    // store the query for each node so that addding a new term get simpler later on
    node.data.value.query = node.path(hierarchy).map(d => d.data.key);
    // do not include the root node's key, which is returned as 'undefined' above
    node.data.value.query.pop();
    node.data.value.query = node.data.value.query.reverse();
    // also do not include the key of the node itself to match the actual query to reach the node

    node.data.value.descriptor = `${dimension.data().name}:${node.data.value.query.join('###')}`;
    node.data.value.query.pop();
  };

  /**
   * Sets the 'siblings' property for a node of the hierarchy, which is list of all descendants of
   * the parent except the node itself.
   * @param   {object} node element of hierarchy
   * @return  {void}
   */
  let setSiblingsToNode = function(node) {
    if (node === hierarchy) {
      node.siblings = [];
    } else {
      node.siblings = node.parent.children.filter(el => el !== node);
    }
  };

  let setPaddingToNode = function(node) {

    let padding;

    if (isFilteredOutByOtherDimensions(node)) {
      padding = 0;
    } else if (node === hierarchy) {
      padding = 0;
    } else if (matchesQuery(node)) {
      // query leaf nodes split totalleafnodepadding
      if (isQueryLeaf(node)) {
        padding = totalLeafNodePadding / node.siblings
          .filter(d => !isFilteredOutByOtherDimensions(d))
          .length;
      }
    } else if (matchesQuery(node.parent)) {
      // composite nodes split totalverticalPadding in two groups: above and below active sibling
      const noOfQueryTerms = dimension.data().queryList.length;

      if (isNodeAboveActiveSibling(node)) {
        const paddingAbovePerQueryLevel = (totalVerticalPadding / 2) / noOfQueryTerms;
        const nodesAboveActiveSibling = node.parent.children
          .filter(d => !isFilteredOutByOtherDimensions(d))
          .filter(isNodeAboveActiveSibling);

        // remove 1 because only n-1 paddings between n nodes
        padding = paddingAbovePerQueryLevel / Math.max(nodesAboveActiveSibling.length - 1, 1);
      } else {
        const paddingBelowPerQueryLevel = (totalVerticalPadding / 2) / noOfQueryTerms;
        const nodesBelowActiveSibling = node.parent.children
          .filter(d => !isFilteredOutByOtherDimensions(d))
          .filter(d => !isNodeAboveActiveSibling(d));

        // remove 2 because only n-1 paddings between n nodes and one of them is the active node
        padding = paddingBelowPerQueryLevel / Math.max(nodesBelowActiveSibling.length - 1, 1);
      }
    } else {
      padding = 0;
    }

    node.verticalPadding = padding;
  };

  /**
   * Finds out if the node is positioned above or below the active node in the neighborhood based on
   * their positions in the parent node's 'children' property
   * @param   {object}  node element of hierarchy
   * @return  {boolean}      whether the element is above the active node in the neighborhood
   */
  let isNodeAboveActiveSibling = function(node) {
    // node is root --> nothing to do
    if (node === hierarchy) return false;
    // node itself is active --> nothing to do
    if (matchesQuery(node)) return false;

    // find the active node in the neighborhood
    const activeSibling = node.siblings.find(matchesQuery);

    // if no active node in neighborhood --> parent is not part of query --> nothing to do
    if (activeSibling === undefined) return false;

    const activeSiblingIndexInParent = node.parent.children.indexOf(activeSibling);
    const workingNodeIndexInParent = node.parent.children.indexOf(node);

    // smaller position --> smaller vertical position (independent of actual y value)
    return workingNodeIndexInParent < activeSiblingIndexInParent;
  };

  /**
   * Sets the 'inactiveHeightPerChild' property for a node in the hierarchy. This property splits
   * the global inactiveHeight over the number of children of this node.
   * @param   {object} node element of hierarchy
   * @return  {void}
   */
  let setInactiveHeightToNode = function(node) {

    const dimensionQueryLength = Math.max(dimension.data().queryList.length, 1);
    const heightPerQueryLevel = totalVerticalHeight / dimensionQueryLength;
    let inactiveHeightPerChild;

    if (isFilteredOutByOtherDimensions(node)) {
      inactiveHeightPerChild = 0;
    } else if (node === hierarchy) {
      inactiveHeightPerChild = heightPerQueryLevel / 2 / node.children.length;
    } else if (matchesQuery(node.parent)) {
      if (isNodeAboveActiveSibling(node)) {
        inactiveHeightPerChild = getHeightAboveActiveSibling(node);
      } else {
        inactiveHeightPerChild = getHeightBelowActiveSibling(node);
      }
    } else {
      inactiveHeightPerChild = 0;
    }

    node.inactiveHeightPerChild = inactiveHeightPerChild;
  };

  const getHeightAboveActiveSibling = function(node) {
    const nodesAboveActiveSibling = node.parent.children
      .filter(d => !isFilteredOutByOtherDimensions(d))
      .filter(isNodeAboveActiveSibling);

    const dimensionQueryLength = Math.max(dimension.data().queryList.length, 1);
    const heightPerQueryLevel = totalVerticalHeight / dimensionQueryLength;
    const noOfNodesAbove = Math.max(nodesAboveActiveSibling.length, 1);

    const aboveInactiveHeightPerChild = (heightPerQueryLevel / 2) / noOfNodesAbove;

    return aboveInactiveHeightPerChild;
  };

  const getHeightBelowActiveSibling = function(node) {
    const nodesAboveActiveSibling = node.parent.children
      .filter(d => !isFilteredOutByOtherDimensions(d))
      .filter(isNodeAboveActiveSibling);

    const dimensionQueryLength = Math.max(dimension.data().queryList.length, 1);
    const heightPerQueryLevel = totalVerticalHeight / dimensionQueryLength;

    if (nodesAboveActiveSibling.length === node.siblings.length) {
      return heightPerQueryLevel;
    }

    const noOfNodesBelow = Math.max(node.siblings.length - nodesAboveActiveSibling.length, 1);

    const belowInactiveHeightPerChild = (heightPerQueryLevel / 2) / noOfNodesBelow;

    return belowInactiveHeightPerChild;
  };

  controller.getHierarchy = function() {
    if (hierarchy === undefined) createHierarchy();
    return hierarchy;
  };

  controller.setHierarchy = function(newHierarchy) {
    hierarchy = newHierarchy;
  };

  controller.sortHierarchy = function(sortingFunction) {
    if (typeof sortingFunction !== 'function') {
      throw Error('hierarchyController: parameter must be of type function');
    }

    hierarchy.sort(sortingFunction);
  };


  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

  controller.dimension = function(_) {
    if (!arguments.length) return dimension;
    if (typeof _ === 'function') dimension = _;
    else throw Error('controller: dimension must be of type function');
    return controller;
  };

  return controller;
};

export default DimensionHierarchyController;