let processedSvg = '<svg id="test-svg" width="100%" xmlns="http://www.w3.org/2000/svg" class="flowchart" style="max-width: 85.4375px;" viewBox="0 0 85.4375 174" role="graphics-document document" aria-roledescription="flowchart-v2">';

const viewBoxMatch = processedSvg.match(/viewBox="[^"]*?([0-9.]+)\s+([0-9.]+)"/);
if (viewBoxMatch) {
  const width = viewBoxMatch[1];
  
  // Remove existing width and style attributes
  processedSvg = processedSvg.replace(/\s+width="[^"]+"/, '');
  processedSvg = processedSvg.replace(/\s+style="[^"]+"/, '');
  
  // Inject the new clean style based on the true SVG dimension
  processedSvg = processedSvg.replace('<svg ', `<svg style="width: ${width}px; max-width: 100%; height: auto;" `);
}

console.log(processedSvg);
