import { ConceptType, VisibilityType, NodeInfo } from './node';

export function getNodeInfoColor(nodeInfo: NodeInfo, fieldName: string = 'concept', defaultColor: string = '#00ffff'): string {
  let color = defaultColor;
  if (fieldName === 'concept') {
    switch (nodeInfo.concept) {
      case ConceptType.Case:
        color = '#5B9BD5';
        break;
      case ConceptType.Folder:
        color = '#70AD47';
        break;
      case ConceptType.Leaf:
        color = '#FFC000';
        break;
      }
    } else if (fieldName === 'visibility') {
      switch (nodeInfo.visibility) {
        case VisibilityType.Active:
          color = '#5B9BD5';
          break;
        case VisibilityType.Inactive:
          color = '#70AD47';
          break;
        case VisibilityType.Hidden:
          color = '#FFC000';
          break;
      }
    } else if (fieldName === 'isSynonym') {
      color = nodeInfo.isSynonym ? '#FF0000' : '#00FF00';
    } else if (fieldName === 'hasMetaData') {
      color = nodeInfo.hasMetaData ? '#FF0000' : '#00FF00';
    }
  return color;
}

export function getNodeInfoOpacity(nodeInfo: NodeInfo, fieldName: string = 'visibility', defaultOpacity: number = 0.5): number {
  let opacity = defaultOpacity;
  if (fieldName === 'concept') {
    switch (nodeInfo.concept) {
      case ConceptType.Case:
        opacity = 1.0;
        break;
      case ConceptType.Folder:
        opacity = 0.6;
        break;
      case ConceptType.Leaf:
        opacity = 0.3;
        break;
      }
    } else if (fieldName === 'visibility') {
      switch (nodeInfo.visibility) {
        case VisibilityType.Active:
          opacity = 1.0;
          break;
        case VisibilityType.Inactive:
          opacity = 0.6;
          break;
        case VisibilityType.Hidden:
          opacity = 0.2;
          break;
      }
    } else if (fieldName === 'isSynonym') {
      opacity = nodeInfo.isSynonym ? 1.0 : 0.5;
    } else if (fieldName === 'hasMetaData') {
      opacity = nodeInfo.hasMetaData ? 1.0 : 0.5;
    }
  return opacity;
}
