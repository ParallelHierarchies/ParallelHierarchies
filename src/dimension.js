parallelHierarchies.dimension = function() {

  let data; // dimension data this element is bound to
  let valueSum; // sum of values

  let observedCategories = []; // list of categories waiting for changes
  let hierarchies;

  // flags indicating the sorting of categories
  let isSortedByDescription = false;
  let isSortedByValue = false;
  let isSortedByMinimization = false;

  // flags indicating if dimension is on the very left or right
  let isFirst = false;
  let isLast = false;

  // scale for vertical positioning of elements. Domain and range are setup in dimension()
  let scaleY;

  // dataprovider to translate dimension query terms into labels
  let dataProvider;

  let minimizedOrder = null;

  let defaultOrder = 'minimize';

  const easing = d3.easePolyOut;
  const duration = 300;

  // D3 SELECTIONS
  let root; // the root selection (=parallelHierachy) the dimension is attached to
  let header; // <g> header of a dimension
  let ancestors; // <g> of ancestor-categories
  let categories; // <g> of active categories (result of query for this dimension)
  let category; // selection of all category elements
  let dropdown;
  let selected;

  // SVG CONFIGURATION
  let height = -1; // maximum vertical space for dimension, MUST be set
  let index = -1; // logical index relative to other dimensions
  let categoryWidth = 12; // width of dimension rect
  let categoryPadding = 90; // total vertical padding split between all categories
  let ancestorPadding = 22; // horizontal padding between levels of hierarchies
  let headerPadding = 120; // space between header and categories

  let x = -1;
  let y = -1;


  let dimension = function(selection) {
    if (height < 0) throw Error('dimension: height must be set and bigger than 0 before calling generator');
    if (index < 0) throw Error('dimension: index must be set and at least 0');
    if (scaleY == null) throw Error('dimension: scaleY must be set');
    if (dataProvider == null) throw Error('dimension: dataProvider must be set');
    if (data == null) throw Error('dimension: data must be set');

    root = selection;

    draw();
  };

  /**
   * Draws all visual components of a dimension and creates event listeners.
   * @return {void}
   */
  let draw = function() {
    drawAncestors();
    drawCategories();
    drawDimensionHeader();
  };

  dimension.update = function(redrawCategories) {
    drawAncestors();

    if (redrawCategories != null && redrawCategories) drawCategories();

    observedCategories.forEach(function(cat) { cat.update() });
  };

  /**
   * Draws the svg components representing the hierarchy for this dimension based on the active
   * query.
   * @return {void}
   */
  let drawAncestors = function() {
    // linear scale that interpolates the ancestor color between a light gray and the signature
    // color of the dimension (assumes maximum level 5)
    let fillColor = d3.scaleLinear().domain([0, 4]).range([data.color, '#969696']);

    root.select('.ancestors').remove();

    ancestors = root.append('g')
      .attr('class', 'ancestors clickable')
      .attr('transform', 'translate('+(-categoryWidth / 2)+', '+headerPadding+')');

    // let offsetY = 0;

    let pad = headerPadding - 50; // total space between top category and title
    let min = height + categoryPadding - headerPadding; // minimum height of ancestors

    if (data.categories.length === 1) min = height - headerPadding;

    let max = min + pad; // maximum height of ancestors
    let siblingsSpace = pad / (data.query.length - 1); // space for siblings per ancestry level

    // for every term in the query for this dimension, add a level of hierarchy on the left and
    // right side of the dimension
    data.query.forEach(function(term, i) {
      let level = ancestors.append('g')
        .datum({ 'term': term, 'level': i })
        .attr('class', 'level')
        .on('click', updateQuryAfterActiveAncestorClicked);

      // get a human readable representation for the query term, since it is still an id at this
      // point
      let label = dataProvider.getLabel(data.name, i, term);

      let fill = fillColor(data.query.length - i);

      // list of sibling-dimensions on ith level
      let siblings = hierarchies.getCategories(data, data.query.slice(0, i));
      // index of current term in siblings
      let siblIndex = siblings.indexOf(siblings.find(function(s) { return s.identifier === term }));

      // get lists of siblings that lie in front and behind the ancestor in the category array
      let siblingsAbove = siblings.slice(0, siblIndex);
      let siblingsBelow = siblings.slice(siblIndex+1);

      let ancestorHeight = max - siblingsSpace * i; // actual height of ancestors on ith level

      // if query has only one term, division by 0 above, so handle seperately
      if (data.query.length === 1) {
        ancestorHeight = min;
        siblingsSpace = pad / 2;
      }

      let offsetY = -(ancestorHeight - min) / 2;

      let activeAncestor = level.append('g')
        .attr('class', 'activeAncestor')
        .attr('transform', d => `translate(0,${d.y = offsetY})`);

      if (i === 0) {
        // <rect> of ancestor
        activeAncestor.append('rect')
          .attr('width', categoryWidth)
          .attr('height', ancestorHeight)
          .attr('fill', fill)
          .attr('dx', -categoryWidth/2);

        // siblings above ancestor
        level.append('g')
          .attr('class', 'siblings above');

        // siblings below ancestor
        level.append('g')
          .attr('class', 'siblings below');

          // text on ancestor-<rect>
        activeAncestor.append('text')
          .attr('text-anchor', 'middle')
          .attr('font-size', categoryWidth)
          .attr('dy', -categoryWidth / 2.6)
          .attr('transform', 'rotate(-90)translate('+-(min)/2+','+categoryWidth*1.2+')')
          .text(label);
      } else {
        // first add ancestors on the right side ...
        if (!isLast) {
          activeAncestor.append('rect')
            .attr('width', categoryWidth)
            .attr('height', ancestorHeight)
            .attr('fill', fill)
            .attr('x', i * (categoryWidth + 4));
          level.append('g')
            .attr('class', 'siblings above')
            .attr('transform', 'translate('+i * (categoryWidth + 4)+',0)');
          level.append('g')
            .attr('class', 'siblings below')
            .attr('transform', 'translate('+i * (categoryWidth + 4)+',0)');
          activeAncestor.append('text')
            .attr('text-anchor', 'middle')
            .attr('font-size', categoryWidth)
            .attr('dy', -categoryWidth / 2.6 + i * (categoryWidth + 4) )
            .attr('transform', 'rotate(-90)translate('+-(min)/2+','+categoryWidth*1.2+')')
            .text(label);
        }

        // ... then on the left side
        if (!isFirst) {
          activeAncestor.append('rect')
            .attr('width', categoryWidth)
            .attr('height', ancestorHeight)
            .attr('fill', fill)
            .attr('x', -i * (categoryWidth + 4))
            .on('click', updateQuryAfterActiveAncestorClicked);
          level.append('g')
            .attr('class', 'siblings above')
            .attr('transform', 'translate('+(-i * (categoryWidth + 4))+',0)');
          level.append('g')
            .attr('class', 'siblings below')
            .attr('transform', 'translate('+(-i * (categoryWidth + 4))+',0)');
          activeAncestor.append('text')
            .attr('text-anchor', 'middle')
            .attr('font-size', categoryWidth)
            .attr('dy', -categoryWidth / 2.6 - i * (categoryWidth + 4) )
            .attr('transform', 'rotate(-90)translate('+-min/2+','+categoryWidth*1.2+')')
            .text(label);
        }
      }

      // heights of one siblings-<rect> depends on the number of siblings that share the space above
      // or below the ancestor
      let aboveHeight = (siblingsSpace / 2 - siblingsAbove.length) / siblingsAbove.length;
      let belowHeight = (siblingsSpace / 2 - siblingsBelow.length) / siblingsBelow.length;

      // FIXME: include this to get same heights on top and bottom
      // aboveHeight = Math.min(aboveHeight, belowHeight);
      // belowHeight = Math.min(aboveHeight, belowHeight);

      // bind those lists to the ancestors
      const ancestorAboveYPosition = (offsetY - siblingsSpace / 2);
      const ancestorBelowYPosition = (ancestorHeight + offsetY);

      level.selectAll('g.siblings.above').selectAll('rect.sibling')
        .data(siblingsAbove).enter().append('rect')
          .attr('class', 'sibling')
          .attr('width', categoryWidth)
          .attr('height', aboveHeight)
          .attr('y', (s, k) => {
            s.y = siblingsSpace / 2 - (k+1) * (aboveHeight + 1) + ancestorAboveYPosition;
            return s.y;
          })
          .on('click', updateQueryAfterInactiveAncestorClicked);

      level.selectAll('g.siblings.below').selectAll('rect.sibling')
        .data(siblingsBelow).enter().append('rect')
          .attr('class', 'sibling')
          .attr('width', categoryWidth)
          .attr('height', belowHeight)
          .attr('y', (s, k) => {
            s.y = k * (belowHeight + 1) + 1 + ancestorBelowYPosition
            return s.y;
          })
          .on('click', updateQueryAfterInactiveAncestorClicked);

      // add event listeners for tooltips
      level.selectAll('.sibling')
        .attr('fill', fill)
        .on('mouseenter', function(d) {
          d3.select(this).classed('highlight', true);
          hierarchies.notify('siblingMouseEnter', {
            'event': d3.event,
            'sibling': d.label
          });
        })
        .on('mouseout', function(d) {
          d3.select(this).classed('highlight', false);
          hierarchies.notify('siblingMouseEnter', null);
        });
    });
  };

  /**
   * Draws the active categories that are the response to the active query in this dimension.
   * @return {void}
   */
  let drawCategories = function() {
    root.select('.categories').remove();

    // categories are offset by half their width to be centred relative to the dimension header
    categories = root.append('g')
      .attr('class', 'categories')
      .attr('transform', 'translate('+(-categoryWidth / 2)+', '+headerPadding+')');

    // reset list of observed category generators
    observedCategories.length = 0;

    data.categories.forEach(function(d) {
      // set the height of the category by summing up all included item values
      let valueSum = hierarchies.getItemValueSum(Object.values(d.items));

      if (typeof valueSum === 'object') {
        d.height = scaleY(d3.sum(valueSum));
        d.timestamps = [scaleY(valueSum[0]), scaleY(valueSum[1])];
      } else {
        d.timestamps = [valueSum];
        d.height = scaleY(valueSum);
      }

      // no items in this category, so don't add a visual representation
      if (d.height === 0) return;

      // category is expandable if entries in the children object exists
      d.expandable = d.children != null && Object.keys(d.children).length > 0;

      // initialize the category generator. x and y will be set by updateCategoryPositions() call.
      let cat = parallelHierarchies.category()
        .data(d)
        .width(categoryWidth)
        .height(d.height)
        .subscribe(dimension);

      // save a reference to this category
      observedCategories.push(cat);
    });

    // for every entry in the categories array, add a category to the dimension
    category = categories.selectAll('.category').data(observedCategories).enter()
      .append('g')
        .attr('class', 'category')
        .classed('grabbable', function(d) { return !d.data().expandable })
        .classed('clickable', function(d) { return d.data().expandable })
        .on('click', function(d) {
          if (d3.event.defaultPrevented) return;
          if (!d.data().expandable) return;

          let myItems = d.data().items
          for (let id in myItems) myItems[id].active = true;

          // add a new term to the query and update the dimension afterwards
          data.query.push(d.data().identifier);
          hierarchies.notify('categoryExpanded', { 'dimension': d.data().dimension });

          d3.event.stopPropagation();
        })
        .on('mouseenter', function(d) {
          hierarchies.notify('categoryMouseEnter', { 'category': d, 'event': d3.event });
        })
        .on('mouseout', function(d) {
          hierarchies.notify('categoryMouseOut', {});
        })
        .each(function(cat) { d3.select(this).call(cat) });

    // add drag behaviour
    category.call(categoryDrag);

    if (defaultOrder === 'minimize') {
      // category = category.sort(sortByMinimization);
    } else if (defaultOrder === 'desc') {
      category = category.sort(sortByDescription);
    } else if (defaultOrder === 'value') {
      category = category.sort(sortByValue);
    }

    if (data.numerical) category = category.sort(sortByDescription);

    updateCategoryPositions();
  };

  /**
   * Creates the header box for the dimension
   * @return  {void}
   */
  let drawDimensionHeader = function() {
    root.select('.header').remove();

    header = root.append('g')
      .attr('class', 'header')
      .attr('transform', 'translate(0, 20)');

    // draw name of dimension
    let title = header.append('text')
      .attr('class', 'title');

    title.append('tspan')
      .style('fill', data.color)
      .text(data.name);

    title.append('tspan')
      .attr('class', 'remove')
      .attr('dx', 10)
      .attr('dy', -2)
      .text('✖')
      .on('click', function() {
        hierarchies.notify('dimensionRemoved', { 'dimension': dimension });
      });

    let opts = ['Value ▼', 'Description ▼', 'Minimized Intersections'];
    let optionSize = 20;

    selected = header.append('text')
      .attr('class', 'selected clickable')
      .attr('dy', optionSize)
      // .text(data.numerical ? opts[1] : opts[opts.length - 1])
      .text(defaultOrder === 'minimize' ? opts[2] : defaultOrder === 'desc' ? opts[1] : opts[0])
      .on('click', function() {
        dropdown.classed('hidden', !dropdown.classed('hidden'));
      });

    dropdown = header.append('g')
      .attr('class', 'dropdown hidden')
      .attr('transform', 'translate(0,'+optionSize * 3+')');

    dropdown.append('rect')
      .attr('class', 'background')
      .attr('width', 200)
      .attr('x', -100)
      .attr('y', -optionSize * 1)
      .attr('height', (opts.length + 0.5) * 20)
      .attr('fill', '#ccc')
      .attr('fill-opacity', .73);

    dropdown.append('g').attr('class', 'options').selectAll('text.option').data(opts).enter()
      .append('text')
        .attr('class', 'option clickable')
        .classed('active', function(d, i) {
          return (i === 2 && !data.numerical) || (i === 1 && data.numerical);
        })
        .attr('y', function(d, i) { return i * 20 })
        .text(function(d) { return d })
        .on('click', function(d, i) {
          // depending on which option was selected, sort the categories by value, description or
          // according to the minimized layout
          if (i === 0) {
            category = category.sort(sortByValue);
            isSortedByValue = !isSortedByValue;
            d3.select(this).text(isSortedByValue ? 'Value ▼' : 'Value ▲');
          } else if (i === 1) {
            category = category.sort(sortByDescription);
            isSortedByDescription = !isSortedByDescription;
            d3.select(this).text(isSortedByDescription ? 'Description ▼' : 'Description ▲');
          } else if (minimizedOrder != null) {
            category = category.sort(sortByMinimization);
          }

          // mark the option active that was clicked on (and inactive for any other option)
          dropdown.selectAll('text.option').classed('active', false);
          d3.select(this).classed('active', true);

          // change the text beneath the title that stores the same value as the clicked on option
          selected.text(d3.select(this).text());

          // update the position of categories based on the chosen sort strategy
          updateCategoryPositions(true);
          // let hierarchies know about changes to update ribbons as well
          hierarchies.notify('categoryPositionChanged', {'dimension': data, 'changed': null, 'exclude': null});
          dropdown.classed('hidden', !dropdown.classed('hidden'));
        });
  };

  /**
   * Updates the position of categories, based on their order in the category selection. If exclude
   * is provided, the category bound to the given categoryobject will not be updated (for dragging).
   * @param {object} exclude  data bound to the category that should not be updated.
   */
  let updateCategoryPositions = function(useTransition, changedCategories, draggedCategory) {
    if (changedCategories == null) changedCategories = [];
    // vertical position depends on previously drawn categories (accumulated with every category)
    let offsetY = 0;

    category.each(function(d, i) {
      // store position of category
      d.x(data.query.length*(categoryWidth + 4))
      d.y(offsetY);
      offsetY += d.height();
      offsetY += categoryPadding / (data.categories.filter(c => c.height > 0).length - 1);
    });

    // selection of all categories that are not the exclude parameter
    let updCategories = category.filter(function(c) {

      return changedCategories.indexOf(c > -1) && c !== draggedCategory;
    });

    // use a transition if needed
    if (useTransition != null && useTransition) {
      updCategories = updCategories.transition().duration(300).ease(easing);
    }

    updCategories.attr('transform', function(d) {
      return 'translate(0,'+d.y()+')';
    });
  };

  /**
   * Remove the term at the level of this ancestor (including all terms on deeper levels)
   * and update the dimension afterwards
   * @param   {object} anc  clicked ancestor object
   * @return  {void}
   */
  let updateQuryAfterActiveAncestorClicked = function(anc) {
    data.query.splice(anc.level);
    hierarchies.notify('categoryCollapsed', { 'dimension': data });
    d3.event.stopPropagation();
  };

   /**
   * Remove the term at the level of this ancestor (including all terms on deeper levels)
   * and add it's term as the last child, thereby making it the current query's result.
   * @param   {object} anc  clicked category object from categoryTree
   * @return  {void}
   */
  let updateQueryAfterInactiveAncestorClicked = function(anc) {
    data.query.splice(anc.level);
    if (anc.expandable) data.query.push(anc.label);
    hierarchies.notify('categoryCollapsed', { 'dimension': data });
    d3.event.stopPropagation();
  };

  let sortByY = function(catA, catB) {
    return catA.y() - catB.y();
  };

  let sortByDescription = function(catA, catB) {
    return isSortedByDescription
    ? catB.data().label < catA.data().label
    : catA.data().label < catB.data().label;
  };

  let sortByValue = function(catA, catB) {
    return isSortedByValue ? catA.height() - catB.height() : catB.height() - catA.height();
  };

  let sortByMinimization = function(catA, catB) {
    let aName = catA.data().identifier;
    let bName = catB.data().identifier;

    return minimizedOrder[aName] - minimizedOrder[bName];
  };

  dimension.highlight = function(itemList) {
    observedCategories.forEach(function(cat) {
      return cat.highlight(itemList);
    });
  };

  /**
   * Given a certain order of category identifiers, sort the generators accordingly.
   * @param   {object} order dictionary assigning each category identifier a position in the
   *                          vertical order of this dimension, which should reduce intersections
   * @return  {void}
   */
  dimension.minimizeIntersections = function(order) {
    minimizedOrder = order;

    if (data.numerical) return;

    if (defaultOrder === 'minimize') {
      // using the provided order, sort categories
      category = category.sort(sortByMinimization);

      // update the category position according to the new positions
      updateCategoryPositions(false);
    }

    // set sorting method labels to false
    isSortedByDescription = false;
    isSortedByValue = false;
  };

  /**
   * Save reference to calling parallelHierarchies generator
   * @return {object} the dimension object itself
   */
  dimension.subscribe = function(observer) {
    hierarchies = observer;
    return dimension;
  };

  dimension.getObservedCategories = function() {
    return observedCategories;
  };

  dimension.getCategoryOrder = function() {
    let order = [];
    category.each(function(cat) { order.push(cat.data()) });
    return order;
  };

  dimension.fisheye = function(fisheye) {
    if (fisheye === null || Math.abs(x - fisheye.focus()[0]) > fisheye.radius()) {
      updateCategoryPositions(false);
      category.each(function(cat) { cat.fisheye(null) });

      ancestors.selectAll('.activeAncestor').attr('transform', d => `translate(0,${d.y})`);
      ancestors.selectAll('rect.sibling').attr('y', d => d.y);
    } else {
      category.each(function(cat) {
        let f = fisheye({x: fisheye.focus()[0], y: cat.y() + y + 100 + cat.height() / 2});
        cat.fisheye(f);
      });
    	category.attr('transform', function(cat, i) {
        return 'translate(0,'+(cat.fy - 100 - cat.height() / 2)+')';
      });
      ancestors.selectAll('.activeAncestor').each(function(anc) {
        const fisheyeX = fisheye.focus()[0];
        const ancestorPosition = {x: fisheyeX, y: anc.y + headerPadding};
        const transformedPosition = fisheye(ancestorPosition);
        d3.select(this)
          .attr('transform', d => `translate(0,${transformedPosition.y - headerPadding})`);
      });
      ancestors.selectAll('rect.sibling').each(function(anc) {
        const fisheyeX = fisheye.focus()[0];
        const ancestorPosition = {x: fisheyeX, y: anc.y + headerPadding};
        const transformedPosition = fisheye(ancestorPosition);
        d3.select(this)
          .attr('y', transformedPosition.y - headerPadding);
      });
    }
  };



  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

  dimension.width = function(_) {
    if (!arguments.length) return width;
    if (typeof _ === 'number') width = _;
    else throw Error('dimension: width must be of type number');
    return dimension;
  };

  dimension.height = function(_) {
    if (!arguments.length) return height;
    if (typeof _ === 'number') height = _;
    else throw Error('dimension: height must be of type number');
    return dimension;
  };

  dimension.padding = function(_) {
    if (!arguments.length) return padding;
    if (typeof _ === 'number') padding = _;
    else throw Error('dimension: padding must be of type number');
    return dimension;
  };

  dimension.headerPadding = function(_) {
    if (!arguments.length) return headerPadding;
    if (typeof _ === 'number') headerPadding = _;
    else throw Error('dimension: headerPadding must be of type number');
    return dimension;
  };

  dimension.x = function(_) {
    if (!arguments.length) return x;
    if (typeof _ === 'number') x = _;
    else throw Error('dimension: x must be of type number');
    return dimension;
  };

  dimension.y = function(_) {
    if (!arguments.length) return y;
    if (typeof _ === 'number') y = _;
    else throw Error('dimension: y must be of type number');
    return dimension;
  };

  dimension.categoryPadding = function(_) {
    if (!arguments.length) return categoryPadding;
    if (typeof _ === 'number') categoryPadding = _;
    else throw Error('dimension: categoryPadding must be of type number');
    return dimension;
  };

  dimension.data = function(_) {
    if (!arguments.length) return data;
    if (typeof _ === 'object') data = _;
    else throw Error('dimension: data must be of type object');
    return dimension;
  };

  dimension.index = function(_) {
    if (!arguments.length) return index;
    if (typeof _ === 'number') index = _;
    else throw Error('dimension: index must be of type number');
    return dimension;
  };

  dimension.defaultOrder = function(_) {
    if (!arguments.length) return defaultOrder;
    if (typeof _ === 'string') defaultOrder = _;
    else throw Error('dimension: defaultOrder must be of type string');
    return dimension;
  };

  dimension.minimizedOrder = function(_) {
    if (!arguments.length) return minimizedOrder;
    if (typeof _ === 'object') minimizedOrder = _;
    else throw Error('dimension: minimizedOrder must be of type object');
    return dimension;
  };

  dimension.isFirst = function(_) {
    if (!arguments.length) return isFirst;
    if (typeof _ === 'boolean') isFirst = _;
    else throw Error('dimension: isFirst must be of type boolean');
    return dimension;
  };

  dimension.isLast = function(_) {
    if (!arguments.length) return isLast;
    if (typeof _ === 'boolean') isLast = _;
    else throw Error('dimension: isLast must be of type boolean');
    return dimension;
  };

  dimension.scaleY = function(_) {
    if (!arguments.length) return scaleY;
    if (typeof _ === 'function') scaleY = _;
    else throw Error('dimension: scaleY must be of type function');
    return dimension;
  };

  dimension.dataProvider = function(_) {
    if (!arguments.length) return dataProvider;
    if (typeof _ === 'object') dataProvider = _;
    else throw Error('dimension: dataProvider must be of type object');
    return dimension;
  };

  // DRAG BEHAVIORS ////////////////////////////////////////////////////////////////////////////////

  const categoryDrag = d3.drag()
    .on('start', function(d) {
      if (!hierarchies.useCategoryDragging()) return;
      if (d3.event.defaultPrevented) return;

      d.dragOffset = d3.mouse(this)[1];
      d3.select(this).classed('dragging', true);
      hierarchies.notify('categoryDragStart', {'cateogry': d});
    })
    .on('drag', function(d) {
      if (!hierarchies.useCategoryDragging()) return;
      if (d3.event.defaultPrevented) return;

      let orderBeforeSort = [];
      let orderAfterSort = [];
      category.each(function(cat) { orderBeforeSort.push(cat) });

      category = category.sort(sortByY);

      category.each(function(cat) { orderAfterSort.push(cat) });

      let changed = [];
      for (let i = 0; i < orderBeforeSort.length; i++) {
        if (orderBeforeSort[i] !== orderAfterSort[i]) {
          changed.push(orderBeforeSort[i]);
        }
      }

      if (changed.indexOf(d) === -1) changed.push(d);

      if (changed.length > 1) updateCategoryPositions(true, changed, d);

      d.y(d3.event.y - d.dragOffset);

      d3.select(this).attr('transform', 'translate('+0+','+d.y()+')');

      hierarchies.notify('categoryPositionChanged', {'dimension': data, 'changed': changed, 'noTransition': d });
    })
    .on('end', function(d) {
      if (!hierarchies.useCategoryDragging()) return;
      if (d3.event.defaultPrevented) return;

      updateCategoryPositions(true);
      hierarchies.notify('categoryPositionChanged', {'dimension': data, 'changed': [d], 'noTransition': null });
      hierarchies.notify('categoryDragEnded', {'cateogry': d});

      d3.select(this).classed('dragging', false);
    });


  return dimension;
}
