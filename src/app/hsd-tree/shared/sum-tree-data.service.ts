import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/from';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/toArray';

import { bind as Bind } from 'bind-decorator';

import {
  Node, NodeInfo, SingleNode, SummaryNode,
  ConceptType, VisibilityType,
  normalizePath,
  stringToConcept, stringToVisibility, stringToIsSynonym, stringToHasMetaData,
  parentPathFor
} from './node';

import { nodes, subtreeBreakdown } from './mock-data';

function makePathFilter(
  paths: string | string[], field: string, modifier?: (path: string) => string
): (node: any) => boolean {
  paths = Array.isArray(paths) ? paths : [paths];
  paths = paths.map(normalizePath);

  if (modifier === undefined) {
    return (node) => paths.includes(normalizePath(node[field]));
  } else {
    return (node) => paths.includes(modifier(normalizePath(node[field])));
  }
}

function groupBy(items: any[], field: string): {} {
  return items.reduce((acc, item) => {
    const key = item[field];
    const group = acc[key] || (acc[key] = []);

    group.push(item);
    return acc;
  }, {});
}

function rawNodeToSingleNode(node: any): SingleNode {
  return {
    type: 'SingleNode',
    level: node['NodeLevel'],
    path: normalizePath(node['NodePath']),
    label: node['NodeName'],
    info: {
      concept: stringToConcept(node['NodeType']),
      visibility: stringToVisibility(node['NodeVisibility']),
      isSynonym: stringToIsSynonym(node['NodeIsSynonym']),
      hasMetaData: stringToHasMetaData(node['NodeHasMetadataXML']),
      numPaths: +node['NumberOfPaths']
    }
  };
}

function rawSummaryNodeToSummaryNodeInfo(node: any): NodeInfo {
  return {
    concept: stringToConcept(node['ConceptType']),
    visibility: stringToVisibility(node['Visibility']),
    isSynonym: stringToIsSynonym(node['IsSynonym']),
    hasMetaData: stringToHasMetaData(node['HasMetadataXML']),
    numPaths: +node['NumberOfPaths']
  };
}

@Injectable()
export class SumTreeDataService {
  constructor() { }

  @Bind
  queryNodes(paths: string | string[]): Observable<SingleNode[]> {
    const pathFilter = makePathFilter(paths, 'NodePath');
    return Observable.from(nodes).filter(pathFilter)
      .map(rawNodeToSingleNode).toArray();
  }

  @Bind
  queryChildNodes(paths: string | string[]): Observable<SingleNode[]> {
    const pathFilter = makePathFilter(paths, 'NodePath', parentPathFor);
    return Observable.from(nodes).filter(pathFilter)
      .map(rawNodeToSingleNode).toArray();
  }

  @Bind
  querySummaryNodes(paths: string | string[]): Observable<SummaryNode[]> {
    const pathFilter = makePathFilter(paths, 'NodePath');
    const entries = (subtreeBreakdown as any[]).filter(pathFilter);
    const byPath = groupBy(entries, 'NodePath');
    const summaryNodes = Observable.from(Object.entries(byPath))
      .map(([path, rawNodes]) => {
        const byLevel = groupBy(rawNodes as any[], 'SubtreeLevel');
        return Object.entries(byLevel).map(([level, acc]) => {
          const breakdown = (acc as any[]).map(rawSummaryNodeToSummaryNodeInfo);
          return {
            type: 'SummaryNode',
            level: +level,
            path: normalizePath(path),
            breakdown: breakdown
          } as SummaryNode;
        }).filter((node) => !isNaN(node.level));
      });

    return summaryNodes;
  }
}
