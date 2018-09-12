import * as d3 from 'd3';

const DataProvider = function() {
  const provider = {};

  let itemFile = ''; // path to file with items
  let schemaFile = ''; // path to file with schema

  let itemID = '_ID'; // unique identifier per item
  let itemValue = 'value'; // dimension that holds the value per item

  let itemListPromise;
  let schemaPromise;

  let itemList; // items as a list
  let schema; // meta information about the items


  /**
   * Add aggregateDimensions property to every item. This property saves the values at every
   * aggregate dimension in the data for easy future access.
   */
  provider.addAggregateDimensions = function(item) {
    item.aggregateDimensions = {};
    schema.timestamps.forEach((aggregateDimension) => {
      item.aggregateDimensions[aggregateDimension] = item[aggregateDimension];
      delete item[aggregateDimension];
    });
  };


  /**
   * Load the data from local source files.
   * @return {object} Promise that the data was loaded
   */
  provider.getData = function() {
    if (itemList != null && schema != null) {
      return new Promise((resolve) => {
        resolve({ schema, itemList });
      });
    }

    if (itemFile === '') throw Error('dataProvider: itemFile not set');
    if (schemaFile === '') throw Error('dataProvider: schemaFile not set');

    return getSchema()
      .then(getItemList)
      .then(() => ({ schema, itemList }));
  };

  let getSchema = async function() {
    if (schemaPromise === undefined) {
      schemaPromise = fetch(schemaFile)
        .then(response => response.json())
        .then(provider.setSchemaFromJson);
    }

    await schemaPromise;

    return schema;
  };

  let getItemList = async function() {
    if (itemListPromise === undefined) {
      itemListPromise = fetch(itemFile)
        .then(response => response.text())
        .then(text => d3.dsvFormat(',').parse(text))
        .then(provider.setItemListFromCSV);
    }

    await itemListPromise;

    return itemList;
  };

  provider.setSchemaFromJson = function(jsonData) {
    // set the relevant parts of the schema
    schema = {};
    schema.title = (jsonData.title || '');
    schema.hierarchies = (jsonData.hierarchies || {});
    schema.unit = (jsonData.unit || '');
    schema.labels = (jsonData.labels || {});
    schema.timestamps = (jsonData.timestamps || [itemValue]);
    schema.numerical = (jsonData.numerical || []);
    schema.dimensions = schema.hierarchies.map(h => h.label);
  };

  provider.setItemListFromCSV = function(csvData) {
    // save the items from data array in dictionary object 'items'
    if (itemList == null) {
      itemList = csvData;
    }

    if (itemList[0][itemID] == null) {
      itemList.forEach((item, i) => { item[itemID] = i; });
    }

    let levels = [];
    Object.values(schema.hierarchies).forEach((h) => { levels = levels.concat(h.levels); });

    Object.keys(itemList[0])
      .filter(dim => dim !== itemValue)
      .filter(dim => dim !== itemID)
      .filter(dim => dim !== 'aggregateDimensions')
      .filter(dim => dim !== 'uncertainty')
      .filter(dim => schema.timestamps.indexOf(dim) === -1)
      .filter(dim => levels.indexOf(dim) === -1)
      .filter(dim => schema.dimensions.indexOf(dim) === -1)
      .forEach((dim) => {
        schema.dimensions.push(dim);
      });
  };

  /**
   * Since the items are stored in csv for storage reasons, hierarchies are stored 'flat' inside the
   * item. This function takes the JSObjects read from the items file and adds the hierarchies
   * according to the schema file.
   * @return {void}
   */
  provider.expandHierarchies = function(item) {
    schema.hierarchies.forEach((hierarchy) => {
      // check if the item contains invalid property
      if (item[hierarchy.label] != null) throw Error('dataProvider: item has invalid property');

      // create new property
      item[hierarchy.label] = {};

      // for every level of that hierarchy, add it to the new property
      for (let l = 0; l < hierarchy.levels.length; l++) {
        // make sure that every item contains at least a value for the first level of every
        // hierarchy
        if ((item[hierarchy.levels[l]] === '' || item[hierarchy.levels[l]] == null) && l === 0) {
          item[hierarchy.label][hierarchy.levels[l]] = 'undefined';
          for (let j = l; j < hierarchy.levels.length; j++) {
            delete item[hierarchy.levels[j]];
          }

          return;
        }

        // check if the item has an entry for that required level and store the value in the
        // complex dimension
        if (item[hierarchy.levels[l]] !== '' && item[hierarchy.levels[l]] != null) {
          item[hierarchy.label][hierarchy.levels[l]] = item[hierarchy.levels[l]];
        }

        // delete reference to hierarchical property
        delete item[hierarchy.levels[l]];
      }
    });
  };

  /**
   * Takes a key and a dimension for any item from the dataset and returns the specific label for
   * this key at the specified dimension.
   * @param   {string}  dim       name of dimension
   * @param   {number}  level     current level of key in dimension hierarchy
   * @param   {string}  key       key that was stored in an item for this dimension
   * @return  {string}            the long-form label for this key in that dimension
   */
  provider.getLabel = function(dim, level, key) {
    let dimension = dim;
    // check if a label exists for this key inside that dimension
    const match = schema.hierarchies.find(s => s.label === dimension);
    if (match !== undefined) dimension = match.levels[level];

    if (dimension === itemID) return key;
    if (dimension === itemValue) return key;
    if (schema.labels[dimension] == null) return key;

    // if (schema.labels[dimension][key] == null) throw Error('dataProvider: key not found');
    // return schema.labels[dimension][key];

    return schema.labels[dimension][key] == null ? key : schema.labels[dimension][key];
  };

  /**
   * Returns the value for a given item at an optional version aggregateDimensions.
   * @param   {object} item               the item of interest
   * @param   {string} aggregateDimension the specific dimension the value should be returned from
   * @return  {number}                    value of item at dimension
   */
  provider.getValue = function(item, aggregateDimension = schema.timestamps[0]) {
    if (item.aggregateDimensions[aggregateDimension] == null) {
      throw Error('dataProvider: cannot get value because aggregate dimension is invalid');
    }

    return +item.aggregateDimensions[aggregateDimension];
  };

  /**
   * Simple getter for the schema data.
   * @return  {object}  the schema object
   */
  provider.getSchema = function() {
    if (schema == null) throw Error('provider: schema not loaded or set');
    return schema;
  };


  // GETTERS + SETTERS for parameters //////////////////////////////////////////////////////////////

  provider.itemFile = function(_) {
    if (!arguments.length) return itemFile;
    if (typeof _ === 'string') itemFile = _;
    else throw Error('dataProvider: itemFile must be of type string');
    itemList = null;
    return provider;
  };

  provider.schemaFile = function(_) {
    if (!arguments.length) return schemaFile;
    if (typeof _ === 'string') schemaFile = _;
    else throw Error('dataProvider: schemaFile must be of type string');
    schema = null;
    return provider;
  };

  provider.itemID = function(_) {
    if (!arguments.length) return itemID;
    if (typeof _ === 'string') itemID = _;
    else throw Error('dataProvider: itemID must be of type string');
    return provider;
  };

  provider.itemValue = function(_) {
    if (!arguments.length) return itemValue;
    if (typeof _ === 'string') itemValue = _;
    else throw Error('dataProvider: itemValue must be of type string');
    return provider;
  };


  return provider;
};

export default DataProvider;
