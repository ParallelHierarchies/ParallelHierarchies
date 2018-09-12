const IntersectionOptimizer = function() {
  const optimizer = {};
  let orders;

  /**
   * Calculate an order in which a minimum of intersection exists between links on the same level.
   * @param   {object}  adjacency the adjacency matrix { a: {x: {}, y: {}}, b: {z: {}}, ... }
   * @return  {object}            dictionary that maps every category in the target dimension to a
   *                              position so that the number of intersection on this level is
   *                              minimized.
   */
  optimizer.barycentricMethod = function(adjacency, useGreedy) {
    console.time('barycentric_method');
    const maxIterations = 10;

    // instead of using lists of complex objects, generate a complete matrix of 0s and 1s indicating
    // adjacency of nodes
    const matrices = convertToMatrices(adjacency);

    // initialize the list of column/row orders with the order sorted by description
    orders = getInitialOrders(adjacency, true);

    let columnBarycenters; // barycenters per column, updated by phaseOneDown()
    let rowBarycenters; // barycenters per row, update by phaseOneUp()

    let bestOrders = orders;
    let bestCount = intersections(matrices, orders);
    let newCount = bestCount;
    let newOrder = orders.map(o => o);

    console.log('initial order:', newOrder);
    console.log('intial state:', bestCount, 'intersections');

    let i;
    for (i = 0; i < maxIterations && intersections(matrices, orders) > 0; i++) {
      // sort columns by barycenters
      phaseOneDown(matrices);
      newCount = intersections(matrices, orders);
      newOrder = orders.map(o => o);
      if (newCount < bestCount) {
        bestCount = newCount;
        bestOrders = newOrder;
      }

      // sort rows by barycenters
      rowBarycenters = phaseOneUp(matrices);
      newCount = intersections(matrices, orders);
      newOrder = orders.map(o => o);
      if (newCount < bestCount) {
        bestCount = newCount;
        bestOrders = newOrder;
      }

      // skip phaseII in the last iteration, as it can only worsen the result
      if (i < maxIterations - 1) {
        // reverse order of rows with equal barycenters
        // rowBarycenters = getRowBarycenters(matrices);
        phaseTwoUp(rowBarycenters);
        if (intersections(matrices, orders) < bestCount) {
          bestCount = intersections(matrices, orders);
          bestOrders = orders.map(o => o);
        }
        // reverse order of columns with equal barycenters
        // need to update columnBarycenters after reordering rows in phaseII UP
        columnBarycenters = getColumnBarycenters(matrices);
        phaseTwoDown(columnBarycenters);
        if (intersections(matrices, orders) < bestCount) {
          bestCount = intersections(matrices, orders);
          bestOrders = orders.map(o => o);
        }
      }

      // reverse order of rows with equal barycenters
      // rowBarycenters = getRowBarycenters(matrices);
      phaseTwoUp(rowBarycenters);
      newCount = intersections(matrices, orders);
      newOrder = orders.map(o => o);
      if (newCount < bestCount) {
        bestCount = newCount;
        bestOrders = newOrder;
      }
      // reverse order of columns with equal barycenters
      // need to update columnBarycenters after reordering rows in phaseII UP
      columnBarycenters = getColumnBarycenters(matrices);
      phaseTwoDown(columnBarycenters);
      newCount = intersections(matrices, orders);
      newOrder = orders.map(o => o);
      if (newCount < bestCount) {
        bestCount = newCount;
        bestOrders = newOrder;
      }
    }

    console.log(intersections(matrices, bestOrders), 'intersections after', i, 'iterations');
    console.timeEnd('barycentric_method');

    if (useGreedy) {
      console.time('greedy');
      console.log('runnig greedy swap');
      bestOrders = greedySwitching(matrices, bestOrders);
      console.log(intersections(matrices, bestOrders), 'intersections after greedy');
      console.timeEnd('greedy');
    }

    return bestOrders;
  };

  optimizer.getIntersections = function(adjacency, orderings) {
    const matrices = convertToMatrices(adjacency);
    return intersections(matrices, orderings);
  };

  let greedySwitching = function(rowMatrices, ordering) {
    let swapped;
    let lastIndex;

    for (let i = 0; i < ordering.length; i++) {
      // stores whether or not a swap occured in the swap loops
      swapped = true;

      // this will point to the last position in the ordering where no swap occured. This prevents
      // unnecessary iterations through the data when restarting the swap loops by restarting at the
      // last 'useful' position instead of the beginnning.
      lastIndex = 0;

      while (swapped) {
        swapped = false;

        const orderList = [];
        const swappedOrders = {};
        const ordersCopy = ordering.map(d => d);

        // derive (ordered) list of headers from 'ordering' dictionary. Has to be called after every
        // swap to sync order in list and dictionary. Also initialize swapped order dicationary with
        // the ordering from orders
        for (const header in ordering[i]) {
          orderList[ordering[i][header]] = header;
          swappedOrders[header] = ordering[i][header];
        }

        // 'swap loops':
        // for every pair of neighboring categories on an axis, switch their order if this reduces
        // the total number of crossings in the visualization
        for (let j = lastIndex; j < orderList.length - 1 && !swapped; j++) {
          for (let k = j + 1; k < orderList.length && !swapped; k++) {
            const a = orderList[j]; // row header a
            const b = orderList[k]; // row header b

            // a and b switch places, which is then ...
            swappedOrders[a] = ordering[i][b];
            swappedOrders[b] = ordering[i][a];

            // ... stored in the orders copy
            ordersCopy[i] = swappedOrders;

            // get intersection counts for the swapped and not swapped case. Doing this in every
            // iteration increases the processing time drastically.
            const countNow = intersections(rowMatrices, ordering);
            const countSwapped = intersections(rowMatrices, ordersCopy);

            // if number of intersections was reduced, use the layout with the 'better' intersection
            // count
            if (countSwapped < countNow) {
              ordering = ordersCopy;
              // restart swap loops at this position
              swapped = true;
              break;
            } else {
              swappedOrders[a] = ordering[i][a];
              swappedOrders[b] = ordering[i][b];
              ordersCopy[i] = swappedOrders;
              lastIndex = j;
            }
          }
        }
      }
    }

    return ordering;
  };

  /**
   * Sort rows by their barycenters.
   * @param   {object}  rowMatrices  adjacencies of neighboring sets of nodes per row
   * @return  {void}
   */
  let phaseOneUp = function(rowMatrices) {
    const rowBarycenters = [];

    // for all row adjacencies, calculate their barycenters and store them (per row)
    for (let i = rowMatrices.length - 1; i >= 0; i--) {
      const rowMatrix = rowMatrices[i];
      rowBarycenters.push({});
      for (const rowHeader in rowMatrix) {
        rowBarycenters[rowMatrices.length - 1 - i][rowHeader] = getBarycenters(rowMatrix[rowHeader], orders[i + 1]);
      }
      orders[i] = sortByBarycenters(rowBarycenters[rowMatrices.length - 1 - i]);
    }

    // rowbarycenters should be in the same order as column barycenters (matching 'orders' obj.), so
    // here the order is reversed (from n...1 to 1...n)
    rowBarycenters.reverse();

    return rowBarycenters;
  };

  /**
   * Sort columns by their barycenters.
   * @param   {object}  rowMatrices  adjacencies of neighboring sets of nodes per row
   * @return  {void}
   */
  let phaseOneDown = function(rowMatrices) {
    const columnBarycenters = [];

    // similar to phaseOneUp(): for all column adjacencies (= transposed rows), calculate their
    // barycenters and store them (per column)
    for (let i = 0; i < rowMatrices.length; i++) {
      const rowMatrix = rowMatrices[i];
      columnBarycenters.push({});
      const columnMatrix = transpose(rowMatrix);
      for (const columnHeader in columnMatrix) {
        columnBarycenters[i][columnHeader] = getBarycenters(columnMatrix[columnHeader], orders[i]);
      }
      orders[i + 1] = sortByBarycenters(columnBarycenters[i]);
    }

    return columnBarycenters;
  };

  /**
   * Reverse order of all rows with equal barycenters.
   * @param   {object}  rowBarycenters  barycenters of rows
   * @return  {void}
   */
  let phaseTwoUp = function(rowBarycenters) {
    for (let i = 0; i < rowBarycenters.length; i++) {
      orders[i] = reverseOrderEqualBarycenters(rowBarycenters[i], orders[i]);
    }
  };

  /**
   * Reverse order of all columns with equal barycenters.
   * @param   {object}  columnBarycenters  barycenters of columns
   * @return  {void}
   */
  let phaseTwoDown = function(columnBarycenters) {
    for (let i = 0; i < columnBarycenters.length; i++) {
      orders[i + 1] = reverseOrderEqualBarycenters(columnBarycenters[i], orders[i + 1]);
    }
  };

  /**
   * Transposes a list of columns into a list of rows
   * @param   {object} vector  columns of the parallelhierarchies adjacency matrix
   * @return  {object}         rows that are the transposed matrix defined by those columns
   */
  let transpose = function(vector) {
    const transposedVector = {}; // dictionary of row headers

    let headers; // stores names of rows for every column

    // the columns do not contain entries for rows that don't share any items with the category
    // of the row. To calculate a full matrix, get a list of all row names that exist in any column
    // and create an entry for every one of those rows
    Object.keys(vector).forEach((column) => {
      headers = Object.keys(vector[column]);
      headers.forEach((h) => {
        if (transposedVector[h] == null) transposedVector[h] = {};
      });
    });

    // fill the rows: if a column exists with (columnName -> rowName), set (rowName -> column)
    // to 1, otherwise set it to 0
    Object.keys(transposedVector).forEach((row) => {
      Object.keys(vector).forEach((column) => {
        transposedVector[row][column] = vector[column][row] == null || vector[column][row] === 0
          ? 0
          : 1;
      });
    });

    return transposedVector;
  };


  /**
   * Given a list of adjacencies from parallelHierarchies, which assigns complex objects to every
   * column in the visualization, this will generate a more handy representation using 0s and 1s
   * to indicate adjancency between nodes.
   * Also generates the inital orders of every adjacency matrix
   * @param   {object} adjacency  adjacency as generated by parallelHierarchies with list->list->obj
   * @return  {object}            list of list of row ajacency vectors between nodes
   */
  let convertToMatrices = function(adjacency) {
    // list of dictionaries (rows) of dictionaries (columns) of 0s and 1s
    const matrices = [];

    for (let i = 0; i < adjacency.length; i++) {
      matrices.push({}); // add new adjacency matrix

      // save default order for new adjacency matrix
      const rowHeaders = Object.keys(adjacency[i]);

      // get complete list of column headers
      let columnHeaders = [];

      // use keys of next adjacency matrix if there is one, otherwise go through all elements of the
      // current matrix and generate a unique list of keys
      if (i < adjacency.length - 1) {
        columnHeaders = Object.keys(adjacency[i + 1]);
      } else {
        for (let h = 0; h < rowHeaders.length; h++) {
          const headers = Object.keys(adjacency[i][rowHeaders[h]]);
          for (let x = 0; x < headers.length; x++) {
            if (columnHeaders.indexOf(headers[x]) === -1) columnHeaders.push(headers[x]);
          }
        }
      }

      for (let r = 0; r < rowHeaders.length; r++) {
        // for every row header, add a new entry
        matrices[i][rowHeaders[r]] = {};

        for (let c = 0; c < columnHeaders.length; c++) {
          if (adjacency[i][rowHeaders[r]][columnHeaders[c]] == null) {
            matrices[i][rowHeaders[r]][columnHeaders[c]] = 0;
          } else {
            matrices[i][rowHeaders[r]][columnHeaders[c]] = 1;
          }
        }
      }
    }

    return matrices;
  };

  /**
   * Given the adjacency object from parallelHierarchies, this generates the inital ordering of the
   * nodes by using either the order in which they appear in the data or sorted by description.
   * @param   {object}  adjacency         adjacency as generated by parallelHierarchies with
   *                                      list->list->obj
   * @param   {boolean} sortByDescription whether or not the initial order should be sorted by
   *                                      sorted by description. If false, the appearance in data is
   *                                      used.
   * @return  {object}                    order in which nodes appear list->list->string
   */
  let getInitialOrders = function(adjacency, sortByDescription = true) {
    const initialOrders = adjacency.map((a) => {
      const order = {};
      let keys = Object.keys(a);

      if (sortByDescription) keys = keys.sort();

      keys.forEach((name, i) => { order[name] = i; });

      return order;
    });

    initialOrders.push({});
    const lastColumnNames = [];
    Object.keys(adjacency[adjacency.length - 1]).forEach((row) => {
      let keys = Object.keys(adjacency[adjacency.length - 1][row]);

      if (sortByDescription) keys = keys.sort();

      for (let k = 0; k < keys.length; k++) {
        if (lastColumnNames.indexOf(keys[k]) === -1) lastColumnNames.push(keys[k]);
      }
    });

    for (let c = 0; c < lastColumnNames.length; c++) {
      initialOrders[initialOrders.length - 1][lastColumnNames[c]] = c;
    }

    return initialOrders;
  };

  /**
   * Given a barycenter matrix of type {a:2.5, b:1.5, c:1}, returns a vector which orders every
   * entry of the given vector ascendingly by their value: { a:0, b:1, c:2 }
   * @param   {object} barycenterVectors  dict of barycenters (EITHER vertical or horizontal)
   * @return  {object}                    assigns a positional index of this node starting at 0
   */
  let sortByBarycenters = function(vector) {
    const sortedVector = {};
    const vectorObjects = [];

    for (const label in vector) {
      vectorObjects.push({ 'label': label, 'value': vector[label] });
    }

    vectorObjects.sort((a, b) => a.value - b.value);

    vectorObjects.forEach((column, j) => {
      sortedVector[column.label] = j;
    });

    return sortedVector;
  };

  /**
   * Given a list of barycenters for matrices and an object assigning a position to every name in
   * each matrix, find those names with equal barycenters per matrix and reverse their assigned
   * order in the given orderVector.
   * @param   {object} barycenterVector  single vector of barycenters
   * @param   {object} orderVector       single vector of ordered barycenters
   * @return  {void}
   */
  let reverseOrderEqualBarycenters = function(barycenterVector, orderVector) {

    const placesPerValue = {};
    const reversedVector = {};
    for (const elem in orderVector) reversedVector[elem] = orderVector[elem];

    // invert the vector: instead of storing a value for each place, store a list of places for
    // each barycentric-value. This allows then to find lists with more than one entry to reverse
    // them
    for (const place in barycenterVector) {
      if (placesPerValue[barycenterVector[place]] == null) placesPerValue[barycenterVector[place]] = [];
      placesPerValue[barycenterVector[place]].push(place);
    }

    // find values assigned to more than one place and reverse their order in orders dictionary
    for (const value in placesPerValue) {
      // ignore empty lists or those with only one place
      if (placesPerValue[value].length < 2) continue;

      const list = placesPerValue[value];

      // sort the list by their position in the orders dictionary to ensure order in array
      list.sort((a, b) => orderVector[a] - orderVector[b]);

      // reverse this ordered list
      list.reverse();

      // take the indeces from the initial order and assign them back in the reversed order
      list.forEach((label, i) => {
        reversedVector[label] = orderVector[list[list.length - 1 - i]];
      });
    }

    // update the order vector
    return reversedVector;
  };

  /**
   * Given a list of rowMatrices, this calculates the barycenters for every column in every matrix
   * of this list
   * @param   {object} rowMatrices  list of rowMatrices
   * @return  {object}              barycenters for every column in the rowmatrices
   */
  let getColumnBarycenters = function(rowMatrices) {
    const columnBarycenters = [];
    let columnMatrix;

    // similar to phaseOneUp(): for all column adjacencies (= transposed rows), calculate their
    // barycenters and store them (per column)
    for (let i = 0; i < rowMatrices.length; i++) {
      const rowMatrix = rowMatrices[i];
      columnBarycenters.push({});
      columnMatrix = transpose(rowMatrix);
      for (const columnHeader in columnMatrix) {
        columnBarycenters[i][columnHeader] = getBarycenters(columnMatrix[columnHeader], orders[i]);
      }
    }

    return columnBarycenters;
  };


  /**
   * Given a list of rowMatrices, this calculates the barycenters for every row in every matrix
   * of this list
   * @param   {object} rowMatrices  list of rowMatrices
   * @return  {object}              barycenters for every row in the rowmatrices
   */
  const getRowBarycenters = function(rowMatrices) {
    const rowBarycenters = [];

    // for all row adjacencies, calculate their barycenters and store them (per row)
    for (let i = rowMatrices.length - 1; i >= 0; i--) {
      const rowMatrix = rowMatrices[i];
      rowBarycenters.push({});
      for (const rowHeader in rowMatrix) {
        rowBarycenters[rowMatrices.length - 1 - i][rowHeader] = getBarycenters(rowMatrix[rowHeader], orders[i + 1]);
      }
    }

    // rowbarycenters should be in the same order as column barycenters (matching 'orders' obj.), so
    // here the order is reversed (from n...1 to 1...n)
    rowBarycenters.reverse();

    return rowBarycenters;
  };

  /**
   * Calculates the barycentric value of a given vector. This value is calculated by multiplying
   * each value in the vector by the position in the ordered columns and dividing it by the number
   * of entries in the vector that are 1.
   * @param   {object} vector      single row/column of transposed matrix
   * @param   {object} barycenters dictionary assigning an index to each element of the matrix' rows
   * @return  {number}             barycentric value for given vector
   */
  let getBarycenters = function(vector, order) {
    let value = 0; // barycentric value
    let nonZeroPlaces = 0; // keeps track of how many places are set (=1 in vector)

    // sum up values for every place multiplied by the position in the order (increased by
    // 1 so that first position does not yield 0)
    for (const place in order) {
      value += vector[place] * (order[place] + 1);
      nonZeroPlaces += vector[place];
    }

    value /= nonZeroPlaces;

    return value;
  };

  /**
   * Calculate the number of crossings between two layers of nodes.
   * @param   {object} interconnection interconnection matrix between two layers of nodes
   * @param   {object} orderMap        order of row headers
   * @return  {number}                 number of intersections in the given ordered set of layers
   */
  let intersections = function(interconnection, orderMap) {
    let crossings = 0;

    interconnection.forEach((matrix, index) => {
      const rowKeys = Object.keys(orderMap[index])
        .sort((kA, kB) => orderMap[index][kA] - orderMap[index][kB]);

      const colKeys = Object.keys(orderMap[index + 1])
        .sort((kA, kB) => orderMap[index + 1][kA] - orderMap[index + 1][kB]);

      // use arrays instead of objects for row vectors, so take lists of values for each element of
      // the matrix object and get number of crossings for those.
      for (let i = 0, len = rowKeys.length; i < len - 1; i++) {
        const rowI = [];

        colKeys.forEach((colKey) => {
          rowI.push(matrix[rowKeys[i]][colKey]);
        });

        for (let j = i + 1; j < len; j++) {
          const rowJ = [];
          colKeys.forEach((colKey) => {
            rowJ.push(matrix[rowKeys[j]][colKey]);
          });

          crossings += intersectionsRowVectors(rowI, rowJ);
        }
      }
    });

    return crossings;
  };

  /**
   * Calculate the number of crossings between two row vectors. For every 1 in a row, count how many
   * 1s there are above and to the right of it.
   * @param   {object} vi first vector
   * @param   {object} vj second vector
   * @return  {number}    total number of crossings between these two vectors
   */
  let intersectionsRowVectors = function(vi, vj) {
    let crossings = 0;
    const n = vi.length;

    for (let t = 0; t <= n - 2; t++) {
      for (let p = t + 1; p <= n - 1; p++) {
        crossings += vj[t] * vi[p];
      }
    }

    return crossings;
  };

  return optimizer;
};

export default IntersectionOptimizer;