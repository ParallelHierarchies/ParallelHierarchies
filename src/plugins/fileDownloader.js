// ADAPTED FROM https://github.com/NYTimes/svg-crowbar
// ADAPTED FROM http://bl.ocks.org/Rokotyan/0556f8facbaf344507cdc45dc3622177

import * as d3 from 'd3';
import saveAs from 'file-saver';
import svg2pdf from 'svg2pdf.js/dist/svg2pdf';
// import * as jsPDF from 'jspdf-yworks'; // see downloadAsPDF() for more info on this import


// MODIFICATION: closure to class
export default class FileDownloader {
  constructor() {
    this.doctype = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
    window.URL = (window.URL || window.webkitURL);
    this.body = document.body;

    // MODIFCATION: add function parameter
    this.svgs = null;

    this.prefix = {
      xmlns: 'http://www.w3.org/2000/xmlns/',
      xlink: 'http://www.w3.org/1999/xlink',
      svg: 'http://www.w3.org/2000/svg',
    };
  }

  getSVGAsBlobs() {
    if (this.svgs === null) {
      throw new Error('svgs parameter must be set before running CrowBar');
    }

    const documents = [window.document];
    const SVGSources = [];
    const iframes = document.querySelectorAll('iframe');
    const objects = document.querySelectorAll('object');

    // add empty svg element
    const emptySvg = window.document.createElementNS(this.prefix.svg, 'svg');
    window.document.body.appendChild(emptySvg);
    const emptySvgDeclarationComputed = getComputedStyle(emptySvg);

    [].forEach.call(iframes, (el) => {
      try {
        if (el.contentDocument) {
          documents.push(el.contentDocument);
        }
      } catch (err) {
        console.log(err);
      }
    });

    [].forEach.call(objects, (el) => {
      try {
        if (el.contentDocument) {
          documents.push(el.contentDocument);
        }
      } catch (err) {
        console.log(err);
      }
    });

    documents.forEach(() => {
      const newSources = this.getSources(emptySvgDeclarationComputed);

      // because of prototype on NYT pages
      for (let i = 0; i < newSources.length; i++) {
        SVGSources.push(newSources[i]);
      }
    });

    if (SVGSources.length === 0) {
      return null;
    }

    return SVGSources;
  }

  downloadAsSVG() {
    const blobs = this.getSVGAsBlobs();

    if (blobs.length > 0) {
      this.download(blobs[0]);
    } else {
      alert('The Crowbar couldn’t find any SVG nodes.');
    }
  }

  downloadAsPNG() {
    const svgString = this.getSVGText()[0];
    const width = d3.select('#parallelHierarchies').attr('width');
    const height = d3.select('#parallelHierarchies').attr('height');

    // passes Blob and filesize String to the callback
    svgString2Image(svgString, width, height, blob => saveAs(blob, 'paralelHierarchies.png'));
  }

  downloadAsPDF() {
    const svgNode = this.svgs[0];

    // FIXME:
    // jsPDF imports do not seem to work as expected (returns rgbcolor when importing from debug
    // release or a function that cannot be used as constructor when using "* as" import) it is
    // therefore included seperately from bundle.js in html
    const pdf = new jsPDF('l', 'pt', [window.innerHeight, window.innerWidth]);

    svg2pdf(svgNode, pdf, { xOffset: 0, yOffset: 0, scale: 1 });

    // get the data URI in base64
    const uri = pdf.output('datauristring');

    // add a dummy anchor element and 'click' it to trigger the download, then remove it from DOM
    const download = document.createElement('a');
    document.getElementsByTagName('body')[0].appendChild(download);
    download.download = 'parallelHierarchies.pdf';
    download.href = uri;
    download.click();
    document.getElementsByTagName('body')[0].removeChild(download);
  }

  // MODIFICATION: remove createPopover()

  // MODIFICATION: remove cleanup()

  // MODIFICATION: add getSVGText()
  getSVGText() {
    const blobs = this.getSVGAsBlobs();

    if (blobs.length === 0) {
      alert('The Crowbar couldn’t find any SVG nodes.');
    }

    return blobs[0].source;
  }

  getSources(emptySvgDeclarationComputed) {
    // MODIFICATION: svgs is a class parameter
    const svgInfo = [];

    [].forEach.call(this.svgs, (svg) => {

      svg.setAttribute('version', '1.1');

      // removing attributes so they aren't doubled up
      svg.removeAttribute('xmlns');
      svg.removeAttribute('xlink');

      // These are needed for the svg
      if (!svg.hasAttributeNS(this.prefix.xmlns, 'xmlns')) {
        svg.setAttributeNS(this.prefix.xmlns, 'xmlns', this.prefix.svg);
      }

      if (!svg.hasAttributeNS(this.prefix.xmlns, 'xmlns:xlink')) {
        svg.setAttributeNS(this.prefix.xmlns, 'xmlns:xlink', this.prefix.xlink);
      }

      setInlineStyles(svg, emptySvgDeclarationComputed);

      const source = (new XMLSerializer()).serializeToString(svg);
      const rect = svg.getBoundingClientRect();
      svgInfo.push({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        class: svg.getAttribute('class'),
        id: svg.getAttribute('id'),
        name: svg.getAttribute('name'),
        childElementCount: svg.childElementCount,
        source: [this.doctype + source],
      });
    });
    return svgInfo;
  }

  download(source) {
    let filename = 'untitled';

    if (source.name) {
      filename = source.name;
    } else if (source.id) {
      filename = source.id;
    } else if (source.class) {
      filename = source.class;
    } else if (window.document.title) {
      filename = window.document.title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    }

    const url = window.URL.createObjectURL(new Blob(source.source, { 'type': 'text/xml' }));

    const a = document.createElement('a');
    this.body.appendChild(a);
    a.setAttribute('class', 'svg-crowbar');
    a.setAttribute('download', `${filename}.svg`);
    a.setAttribute('href', url);
    a.style.display = 'none';
    a.click();

    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 10);
  }
}

// MODIFICATION: setInlineStyles does not use class parameters, so it can be extracted from class
const setInlineStyles = function(svg, emptySvgDeclarationComputed) {
  function explicitlySetStyle (element) {
    const cSSStyleDeclarationComputed = getComputedStyle(element);

    let i;
    let len;
    let key;
    let value;

    let computedStyleStr = '';
    for (i = 0, len = cSSStyleDeclarationComputed.length; i < len; i++) {
      key = cSSStyleDeclarationComputed[i];
      value = cSSStyleDeclarationComputed.getPropertyValue(key);
      if (value !== emptySvgDeclarationComputed.getPropertyValue(key)) {
        computedStyleStr += `${key}:${value};`;
      }
    }
    element.setAttribute('style', computedStyleStr);
  }
  function traverse(obj) {
    const tree = [];
    tree.push(obj);
    visit(obj);
    function visit(node) {
      if (node && node.hasChildNodes()) {
        let child = node.firstChild;
        while (child) {
          if (child.nodeType === 1 && child.nodeName !== 'SCRIPT') {
            tree.push(child);
            visit(child);
          }
          child = child.nextSibling;
        }
      }
    }
    return tree;
  }
  // hardcode computed css styles inside svg
  const allElements = traverse(svg);
  let i = allElements.length;
  while (i--) {
    explicitlySetStyle(allElements[i]);
  }
};

function svgString2Image(svgString, width, height, callback) {
  const imgsrc = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`; // Convert SVG string to data URL

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  const image = new Image();
  image.onload = function() {
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    canvas.toBlob((blob) => {
      const filesize = `${Math.round(blob.length / 1024)} KB`;
      if (callback) callback(blob, filesize);
    }, 'image/png');
  };

  image.src = imgsrc;
}
