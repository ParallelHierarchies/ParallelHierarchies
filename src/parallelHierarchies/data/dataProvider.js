import * as d3 from 'd3';

export default class DataProvider {
  constructor() {
    this.itemFile = ''; // path to file with items
    this.schemaFile = ''; // path to file with schema

    this.itemID = '_ID'; // unique identifier per item
    this.itemValue = 'value'; // dimension that holds the value per item

    this.itemListPromise = null;
    this.schemaPromise = null;

    this.itemList = null; // items as a list
    this.schema = null; // meta information about the items
  }

  /**
   * Add aggregateDimensions property to every item. This property saves the values at every
   * aggregate dimension in the data for easy future access.
   */
  addAggregateDimensions(item) {
    item.aggregateDimensions = {};
    this.schema.timestamps.forEach((aggregateDimension) => {
      item.aggregateDimensions[aggregateDimension] = item[aggregateDimension];
      delete item[aggregateDimension];
    });
  }


  /**
   * Load the data from local source files.
   * @return {object} Promise that the data was loaded
   */
  getData() {
    if (this.itemList != null && this.schema != null) {
      return new Promise((resolve) => {
        resolve({ schema: this.schema, itemList: this.itemList });
      });
    }

    if (this.itemFile === '') throw Error('dataProvider: itemFile not set');
    if (this.schemaFile === '') throw Error('dataProvider: schemaFile not set');

    return this.fetchSchema()
      .then(() => this.fetchItemList())
      .then(() => ({ schema: this.schema, itemList: this.itemList }));
  }

  async fetchSchema() {
    if (this.schemaPromise === null) {
      this.schemaPromise = fetch(this.schemaFile)
        .then(response => response.json())
        .then(res => this.setSchemaFromJson(res));
    }

    await this.schemaPromise;

    return this.schema;
  }

  async fetchItemList() {
    if (this.itemListPromise === null) {
      this.itemListPromise = fetch(this.itemFile)
        .then(response => response.text())
        .then(text => d3.dsvFormat(',').parse(text))
        .then(res => this.setItemListFromCSV(res));
    }

    await this.itemListPromise;

    return this.itemList;
  }

  setSchemaFromJson(jsonData) {
    // set the relevant parts of the schema
    this.schema = {};
    this.schema.title = (jsonData.title || '');
    this.schema.hierarchies = (jsonData.hierarchies || {});
    this.schema.unit = (jsonData.unit || '');
    this.schema.labels = (jsonData.labels || {});
    this.schema.timestamps = (jsonData.timestamps || [this.itemValue]);
    this.schema.numerical = (jsonData.numerical || []);
    this.schema.dimensions = this.schema.hierarchies.map(h => h.label);
  }

  setItemListFromCSV(csvData) {
    // save the items from data array in dictionary object 'items'
    if (this.itemList == null) {
      this.itemList = csvData;
    }

    if (this.itemList[0][this.itemID] == null) {
      this.itemList.forEach((item, i) => { item[this.itemID] = i; });
    }

    let levels = [];
    Object.values(this.schema.hierarchies).forEach((h) => { levels = levels.concat(h.levels); });

    Object.keys(this.itemList[0])
      .filter(dim => dim !== this.itemValue)
      .filter(dim => dim !== this.itemID)
      .filter(dim => dim !== 'aggregateDimensions')
      .filter(dim => dim !== 'uncertainty')
      .filter(dim => this.schema.timestamps.indexOf(dim) === -1)
      .filter(dim => levels.indexOf(dim) === -1)
      .filter(dim => this.schema.dimensions.indexOf(dim) === -1)
      .forEach((dim) => {
        this.schema.dimensions.push(dim);
      });
  }

  /**
   * Since the items are stored in csv for storage reasons, hierarchies are stored 'flat' inside the
   * item. This function takes the JSObjects read from the items file and adds the hierarchies
   * according to the schema file.
   * @return {void}
   */
  expandHierarchies(item) {
    this.schema.hierarchies.forEach((hierarchy) => {
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
  }

  /**
   * Takes a key and a dimension for any item from the dataset and returns the specific label for
   * this key at the specified dimension.
   * @param   {string}  dim       name of dimension
   * @param   {number}  level     current level of key in dimension hierarchy
   * @param   {string}  key       key that was stored in an item for this dimension
   * @return  {string}            the long-form label for this key in that dimension
   */
  getLabel(dim, level, key) {
    let dimension = dim;
    // check if a label exists for this key inside that dimension
    const match = this.schema.hierarchies.find(s => s.label === dimension);
    if (match !== undefined) dimension = match.levels[level];

    if (dimension === this.itemID) return key;
    if (dimension === this.itemValue) return key;
    if (this.schema.labels[dimension] == null) return key;

    // if (schema.labels[dimension][key] == null) throw Error('dataProvider: key not found');
    // return schema.labels[dimension][key];

    return this.schema.labels[dimension][key] == null ? key : this.schema.labels[dimension][key];
  }

  /**
   * Returns the value for a given item at an optional version aggregateDimensions.
   * @param   {object} item               the item of interest
   * @param   {string} aggregateDimension the specific dimension the value should be returned from
   * @return  {number}                    value of item at dimension
   */
  getValue(item, aggregateDimension) {
    // cannot use default parameters because schema itself may be  null
    if (aggregateDimension === undefined && this.schema !== null) {
      aggregateDimension = this.schema.timestamps[0];
    }
    if (item.aggregateDimensions[aggregateDimension] == null) {
      throw Error('dataProvider: cannot get value because aggregate dimension is invalid');
    }

    return +item.aggregateDimensions[aggregateDimension];
  }

  /**
   * Simple getter for the schema data.
   * @return  {object}  the schema object
   */
  getSchema() {
    if (this.schema == null) throw Error('provider: schema not loaded or set');
    return this.schema;
  }
}
