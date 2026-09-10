import { PDFDocument, PDFName, PDFString, PDFRef, PDFDict } from 'pdf-lib';

interface Heading {
  level: number;
  title: string;
  id: string;
  pageIndex: number;
}

interface OutlineItem {
  heading: Heading;
  ref: PDFRef;
  parent?: OutlineItem;
  children: OutlineItem[];
}

export function injectOutline(doc: PDFDocument, headings: Heading[]) {
  const context = doc.context;
  const outlinesDictRef = context.register(context.obj({ Type: 'Outlines' }));
  
  // Build a tree
  const rootItems: OutlineItem[] = [];
  const stack: OutlineItem[] = [];
  
  for (const h of headings) {
    const item: OutlineItem = {
      heading: h,
      ref: context.register(context.obj({
        Title: PDFString.of(h.title),
        Dest: PDFString.of(h.id),
      })),
      children: []
    };
    
    // Find parent
    while (stack.length > 0 && stack[stack.length - 1].heading.level >= h.level) {
      stack.pop();
    }
    
    if (stack.length > 0) {
      const parent = stack[stack.length - 1];
      item.parent = parent;
      parent.children.push(item);
    } else {
      rootItems.push(item);
    }
    
    stack.push(item);
  }
  
  if (rootItems.length === 0) return;
  
  // Helper to count visible descendants (for Count property)
  const countDescendants = (item: OutlineItem): number => {
    let count = item.children.length;
    for (const child of item.children) {
      count += countDescendants(child);
    }
    return count;
  };
  
  // Traverse tree to link First, Last, Next, Prev, Parent
  const linkItems = (items: OutlineItem[], parentRef: PDFRef) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const dict = context.lookup(item.ref) as PDFDict;
      
      dict.set(PDFName.of('Parent'), parentRef);
      if (i > 0) dict.set(PDFName.of('Prev'), items[i - 1].ref);
      if (i < items.length - 1) dict.set(PDFName.of('Next'), items[i + 1].ref);
      
      if (item.children.length > 0) {
        dict.set(PDFName.of('First'), item.children[0].ref);
        dict.set(PDFName.of('Last'), item.children[item.children.length - 1].ref);
        dict.set(PDFName.of('Count'), context.obj(countDescendants(item))); // positive means open by default
        linkItems(item.children, item.ref);
      }
    }
  };
  
  linkItems(rootItems, outlinesDictRef);
  
  const outlinesDict = context.lookup(outlinesDictRef) as PDFDict;
  outlinesDict.set(PDFName.of('First'), rootItems[0].ref);
  outlinesDict.set(PDFName.of('Last'), rootItems[rootItems.length - 1].ref);
  outlinesDict.set(PDFName.of('Count'), context.obj(rootItems.length));
  
  doc.catalog.set(PDFName.of('Outlines'), outlinesDictRef);
}
