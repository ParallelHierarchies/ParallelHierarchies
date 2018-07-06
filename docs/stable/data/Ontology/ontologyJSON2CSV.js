const fs = require('fs');
const stringify = require('csv-stringify');

let nodes = JSON.parse(fs.readFileSync('./data/Ontology/ontology_full.json')).nodes;

let header = [
  "Value",
  "Status",
  "Strand",
  "Locus0",
  "Locus1",
  "CC0",
  "CC1",
  "CC2",
  "CC3",
  "CC4",
  "CC5",
  "CC6",
  "CC7",
  "CC8",
  "CC9",
  "CC10",
  "CC11",
  "CC12",
  "CC13",
  "CC14",
  "BP0",
  "BP1",
  "BP2",
  "BP3",
  "BP4",
  "BP5",
  "BP6",
  "BP7",
  "BP8",
  "BP9",
  "BP10",
  "BP11",
  "BP12",
  "BP13",
  "BP14",
  "MF0",
  "MF1",
  "MF2",
  "MF3",
  "MF4",
  "MF5",
  "MF6",
  "MF7",
  "MF8",
  "MF9",
  "MF10",
  "MF11",
  "MF12",
  "MF13",
  "MF14"
]

let stringifier = stringify(nodes, { header, columns: header, delimiter: ',' }, (err, out) => {
  if (err) throw err;

  fs.writeFile(`./data/Ontology/ontology_items.csv`, out, error => { if (error) throw error });
  console.log(`Writing items to file finished.`);
});

return 0;
