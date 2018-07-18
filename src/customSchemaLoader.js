const customSchemaLoader = function() {
  const DEFAULT_TITLE = "My Custom Data";
  const DEFAULT_UNIT = "units";
  const DEFAULT_VALUE = "Value";

  const component = {
    schema: {
      hierarchies: [],
      title: DEFAULT_TITLE,
      timestamps: [DEFAULT_VALUE],
      unit: DEFAULT_UNIT,
      numerical: []
    },
    itemList: []
  };

  const itemFileReader = new FileReader();
  let itemsFileInput = null;

  itemFileReader.onload = function() {
    component.itemList = d3.csvParse(this.result);
    component.schema.dimensions = Object.keys(component.itemList[0]);
    component.schema.labels = {};
    Object.keys(component.itemList[0]).forEach((label) => {
      component.schema.labels[label] = {};
    });
  };

  component.loadSchemaAndItems = function() {
    if (itemsFileInput === null) return;

    const itemFile = itemsFileInput.files[0];
    itemFileReader.readAsText(itemFile);
  };

  component.addUserHierarchy = function(label, levels) {
    component.schema.hierarchies.push({label, levels});
  };

  component.removeUserHierarchy = function(label) {
    const hierarchy = component.schema.hierarchies.find(d => d.label === label);
    if (hierarchy === undefined) return;
    const indexOfHierarchy = component.schema.hierarchies.indexOf(hierarchy);

    component.schema.hierarchies.splice(indexOfHierarchy, 1);
  };


  component.itemsFileInput = function(_) {
    if (!arguments.length) return itemsFileInput;
    itemsFileInput = _;
    return component;
  };
  component.onLoadEnd = function(_) {
    if (!arguments.length) return itemsFileInput;
    itemFileReader.onloadend = _;
    return component;
  };

  return component;
};