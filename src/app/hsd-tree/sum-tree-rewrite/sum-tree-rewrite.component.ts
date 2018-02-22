import {
  Component, OnInit, OnChanges, OnDestroy,
  Input, ViewChild,
  ElementRef, SimpleChanges
} from '@angular/core';

import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/empty';
import 'rxjs/add/observable/merge';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/reduce';
import 'rxjs/add/operator/toArray';

import { bind as Bind } from 'bind-decorator';

import { vega, defaultLogLevel } from '../../vega';
import { SumTreeDataService } from '../shared/sum-tree-data.service';
import {
  Node, SingleNode, SummaryNode,
  isParentOf, isAncestorOf,
  filterLeafs
} from '../shared/node';
import {
  InternalNode, InternalSingleNode, InternalSummaryNode,
  convertToInternalSingleNode, convertToInternalSummaryNode
} from './internal-nodes';
import vegaSpec, {
  inputDataSetNames,
  inputSignalNames, outputSignalNames
} from './vega-spec';

@Component({
  selector: 'hsd-sum-tree-rewrite',
  templateUrl: './sum-tree-rewrite.component.html',
  styleUrls: ['./sum-tree-rewrite.component.sass']
})
export class SumTreeRewriteComponent implements OnInit, OnChanges, OnDestroy {
  private vegaInstance: any;

  @ViewChild('vegaVis') visElement: ElementRef;
  @ViewChild('vegaInput') inputElement: ElementRef;

  @Input() vegaLogLevel = defaultLogLevel;
  @Input() initialNodePaths = [
    '\\pcori',
      '\\pcori\\demographic',
      '\\pcori\\diagnosis',
      '\\pcori\\encounter',
      '\\pcori\\enrollment',
      '\\pcori\\lab_result_cm',
      '\\pcori\\medication',
      '\\pcori\\procedure',
        '\\pcori\\procedure\\09',
        '\\pcori\\procedure\\10',
        '\\pcori\\procedure\\11',
        '\\pcori\\procedure\\ch',
        '\\pcori\\procedure\\lc',
        '\\pcori\\procedure\\nd',
        '\\pcori\\procedure\\re',
        '\\pcori\\procedure\\version',
      '\\pcori\\vital'
  ];

  constructor(private service: SumTreeDataService) { }

  ngOnInit() {
    this.createVegaInstance();
  }

  ngOnChanges(changes: SimpleChanges) {
    // TODO
  }

  ngOnDestroy() {
    this.destroyVegaInstance();
  }

  // Vega setup
  private createVegaInstance(): void {
    const parsedSpec = vega.parse(vegaSpec);
    const instance = this.vegaInstance = new vega.View(parsedSpec)
      .renderer('svg') // In the future this might be replaced by a custom renderer
      .initialize(this.visElement.nativeElement, this.inputElement.nativeElement)
      .logLevel(this.vegaLogLevel)
      .hover(); // Enable default handling of hover

    const signalsInitialized = this.setSignalValues(instance);
    const signalsAttached = this.attachSignalListeners(instance);
    const dataInitialized = this.setDataTuples(instance);

    const initialized = Observable.merge(
      signalsInitialized, signalsAttached,
      dataInitialized
    );

    // Run visualization
    initialized.subscribe(undefined, undefined, () => instance.run());

    // Temporary - Debugging
    console.log(instance);
  }

  private destroyVegaInstance(): void {
    if (this.vegaInstance) {
      this.vegaInstance.finalize();
    }
  }

  private setSignalValues(instance: any): Observable<any> {
    const {
      maxLevelName,
      yMultiplierName, yOffsetName,
      summaryBoxSizeName
    } = inputSignalNames;

    // Required
    instance.signal(maxLevelName, 11); // TODO fix value

    // Optional
    instance.signal(yMultiplierName, 30);
    // instance.signal(yOffsetName, 30);

    // instance.signal(summaryBoxSizeName, {
    //   width: 15,
    //   height: 20
    // });

    return Observable.empty();
  }

  private attachSignalListeners(instance: any): Observable<any> {
    const {
      nodeClickName, summaryClickName,
      summaryTypeName, colorName, opacityName
    } = outputSignalNames;

    instance.addSignalListener(nodeClickName, this.onNodeClick);
    instance.addSignalListener(summaryClickName, this.onSummaryClick);

    instance.addSignalListener(summaryTypeName, this.onSummaryTypeChange);
    instance.addSignalListener(colorName, this.onColorFieldChange);
    instance.addSignalListener(opacityName, this.onOpacityFieldChange);

    return Observable.empty();
  }

  private setDataTuples(instance: any): Observable<any> {
    const { nodesName, summariesName } = inputDataSetNames;

    const singleNodes = this.queryAndSetDataTuples<InternalSingleNode>(
      instance, this.initialNodePaths, nodesName, 'queryNodes', (node) => {
        return convertToInternalSingleNode(node); // TODO additional arguments
      }
    );

    const leafPaths = singleNodes.map(filterLeafs)
      .map((nodes) => nodes.map((node) => node.path));

    const summaryNodes = this.queryAndSetDataTuples(
      instance, leafPaths, summariesName, 'querySummaryNodes', (node) => {
        return convertToInternalSummaryNode(node); // TOD additional arguments
      }
    );

    return summaryNodes;
  }

  private queryAndSetDataTuples<T>(
    instance: any, paths: string | string[] | Observable<string[]>,
    setName: string, queryFunc: string, modifier?: (tuple: any) => T
  ): Observable<T[]> {
    paths = typeof paths === 'string' ? [paths] : paths;
    paths = Array.isArray(paths) ? Observable.of(paths) : paths;

    const rawTuples: Observable<any[]> = paths.mergeMap((paths_) => this.service[queryFunc](paths_));
    const allRawTuples = rawTuples.reduce((acc, tuples_) => acc.concat(tuples_), []);
    const tuples = modifier ? allRawTuples.map((tuples_) => tuples_.map(modifier)) : allRawTuples as Observable<T[]>;

    return tuples.do((tuples_) => instance.insert(setName, tuples_));
  }

  // Events
  // Do not call vegaInstance.run() directly in the callbacks!
  // Use vegaInstance.runAfter(vegaInstance.run.bind(vegaInstance))
  @Bind
  private onNodeClick(name: string, node: InternalSingleNode): void {
    if (node === undefined) {
      return;
    }

    const { nodesName, summariesName } = inputDataSetNames;
    const instance = this.vegaInstance;
    const nodes: InternalSingleNode[] = instance.data(nodesName);
    const expanded = nodes.some((inode) => isParentOf(node, inode));
    const nodeChanges = vega.changeset();
    const summaryChanges = vega.changeset();
    const events: Observable<any>[] = [];

    if (expanded) {
      nodeChanges.remove((inode) => isAncestorOf(node, inode));
      summaryChanges.remove((inode) => isAncestorOf(node, inode));
      events.push(this.service.querySummaryNodes(node.path).do((snodes) => {
        // TODO calculate stuff for snodes
        summaryChanges.insert(snodes);
      }));
    } else {
      summaryChanges.remove((inode) => isAncestorOf(node, inode));
      const childNodes = this.service.queryChildNodes(node.path).do((snodes) => {
        // TODO calculat stuff for snodes
        nodeChanges.insert(snodes);
      });
      const childSummaryNodes = childNodes.map((snode) => snode.map((n) => n.path))
        .mergeMap(this.service.querySummaryNodes).do((snodes) => {
          // TODO calculate stuff for snodes
          summaryChanges.insert(snodes);
        });

      events.push(childSummaryNodes);
    }

    // Apply changes after all events have completed and rerun dataflow
    Observable.merge(...events).subscribe(undefined, undefined, () => {
      instance.change(nodesName, nodeChanges);
      instance.change(summariesName, summaryChanges);
      instance.runAfter(instance.run.bind(instance));
    });
  }

  @Bind
  private onSummaryClick(name: string, node: InternalSummaryNode): void {
    // TODO
    // Outline
    // Remove this node and direct and indirect children with isAncestorOf
    // Add SingleNodes for this node's parent
    // Add summaries for the inserted nodes
  }

  @Bind
  private onSummaryTypeChange(name: string, type: string): void {
    // TODO
  }

  @Bind
  private onColorFieldChange(name: string, value: string): void {
    // TODO
  }

  @Bind
  private onOpacityFieldChange(name: string, value: string): void {
    // TODO
  }
}
