import { visit } from 'unist-util-visit';
import { Node, Parent } from 'unist';

interface TextNode extends Node {
  type: 'text';
  value: string;
}

function isTextNode(node: Node): node is TextNode {
  return node.type === 'text';
}

function isParent(node: Node): node is Parent {
  return 'children' in node && Array.isArray((node as Parent).children);
}

export default function remarkHighlight() {
  return (tree: Node) => {
    // We visit bottom-up so that nested parents are processed before their ancestors
    visit(tree, (node: Node) => {
      if (!isParent(node)) return;
      
      const children = node.children;
      let i = 0;
      
      while (i < children.length) {
        const child = children[i];
        
        if (isTextNode(child)) {
          let searchStartIndex = 0;
          let matchFound = false;
          
          while (searchStartIndex < child.value.length) {
            const startMatchIndex = child.value.indexOf('==', searchStartIndex);
            if (startMatchIndex === -1) break; // No more start markers in this node
            
            // Look for the end marker
            let endChildIndex = -1;
            let endMatchIndex = -1;
            
            // Case 1: Same node
            const sameNodeEndMatch = child.value.indexOf('==', startMatchIndex + 2);
            if (sameNodeEndMatch === startMatchIndex + 2) {
              // It's `====`, empty highlight. Skip this as an end marker.
              // Wait, if it's `====`, we should just advance the searchStartIndex and try again
              searchStartIndex = startMatchIndex + 2;
              continue;
            }
            
            if (sameNodeEndMatch !== -1) {
              endChildIndex = i;
              endMatchIndex = sameNodeEndMatch;
            } else {
              // Case 2: Subsequent node
              for (let j = i + 1; j < children.length; j++) {
                const sibling = children[j];
                if (isTextNode(sibling)) {
                  const endMatch = sibling.value.indexOf('==');
                  if (endMatch !== -1) {
                    // Check if it's immediately at the start and the last node ended abruptly?
                    // Not strictly necessary to check for empty here, as it spans nodes so it's not empty.
                    endChildIndex = j;
                    endMatchIndex = endMatch;
                    break;
                  }
                }
              }
            }
            
            if (endChildIndex !== -1) {
              matchFound = true;
              const markChildren: any[] = [];
              const newChildren: any[] = [];
              
              if (startMatchIndex > 0) {
                newChildren.push({ type: 'text', value: child.value.slice(0, startMatchIndex) });
              }
              
              if (endChildIndex === i) {
                const innerText = child.value.slice(startMatchIndex + 2, endMatchIndex);
                if (innerText.length > 0) {
                  markChildren.push({ type: 'text', value: innerText });
                }
                
                const afterEnd = child.value.slice(endMatchIndex + 2);
                newChildren.push({ type: 'mark', data: { hName: 'mark' }, children: markChildren });
                if (afterEnd.length > 0) {
                  newChildren.push({ type: 'text', value: afterEnd });
                }
                
                children.splice(i, 1, ...newChildren);
                i += newChildren.length - (afterEnd.length > 0 ? 2 : 1);
              } else {
                const firstInner = child.value.slice(startMatchIndex + 2);
                if (firstInner.length > 0) {
                  markChildren.push({ type: 'text', value: firstInner });
                }
                
                for (let k = i + 1; k < endChildIndex; k++) {
                  markChildren.push(children[k]);
                }
                
                const endChild = children[endChildIndex] as TextNode;
                const lastInner = endChild.value.slice(0, endMatchIndex);
                if (lastInner.length > 0) {
                  markChildren.push({ type: 'text', value: lastInner });
                }
                
                const afterEnd = endChild.value.slice(endMatchIndex + 2);
                newChildren.push({ type: 'mark', data: { hName: 'mark' }, children: markChildren });
                if (afterEnd.length > 0) {
                  newChildren.push({ type: 'text', value: afterEnd });
                }
                
                const nodesToRemove = endChildIndex - i + 1;
                children.splice(i, nodesToRemove, ...newChildren);
                i += newChildren.length - (afterEnd.length > 0 ? 2 : 1);
              }
              break; // Break the inner string search, we modified the AST array
            } else {
              // No end marker found for THIS start marker.
              // Advance search index to look for another start marker in the same node.
              searchStartIndex = startMatchIndex + 2;
            }
          }
          
          if (matchFound) {
            continue; // We already adjusted `i`, process next iteration
          }
        }
        
        i++;
      }
    });
  };
}
