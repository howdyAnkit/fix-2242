import startCase from 'lodash/startCase';
import { Component, OnInit } from '@angular/core';
import {
  JsonFormsAngularService,
  JsonFormsArrayControl,
} from '@jsonforms/angular';
import {
  ArrayControlProps,
  ArrayTranslations,
  ControlElement,
  createDefaultValue,
  deriveTypes,
  encode,
  isObjectArrayControl,
  isPrimitiveArrayControl,
  JsonSchema,
  mapDispatchToArrayControlProps,
  or,
  OwnPropsOfRenderer,
  Paths,
  RankedTester,
  rankWith,
  setReadonly,
  UISchemaElement,
} from '@jsonforms/core';
import { CdkTableModule} from '@angular/cdk/table';
import {DataSource} from '@angular/cdk/table';
import { Pipe, PipeTransform } from '@angular/core';


@Component({
  selector: 'TableRenderer',
  template: `
    <p>TABLE </p>
    <table
      mat-table
      [dataSource]="data"
      class="mat-elevation-z8"
      [trackBy]="trackElement"
    >
      <ng-container matColumnDef="action">
        <tr>
          <th mat-header-cell *matHeaderCellDef>
            <button
              mat-button
              color="primary"
              (click)="add()"
              [disabled]="!isEnabled()"
            >
              <mat-icon>add</mat-icon>
            </button>
          </th>
        </tr>
        <tr>
          <td
            mat-cell
            *matCellDef="
              let row;
              let i = index;
              let first = first;
              let last = last
            "
          >
            <button
              *ngIf="uischema?.options?.showSortButtons"
              class="item-up"
              mat-button
              [disabled]="first"
              (click)="up(i)"
              matTooltipPosition="right"
            >
              <mat-icon>arrow_upward</mat-icon>
            </button>
            <button
              *ngIf="uischema?.options?.showSortButtons"
              class="item-down"
              mat-button
              [disabled]="last"
              (click)="down(i)"
              matTooltipPosition="right"
            >
              <mat-icon>arrow_downward</mat-icon>
            </button>
            <button
              mat-button
              color="warn"
              (click)="remove(i)"
              [disabled]="!isEnabled()"
              matTooltipPosition="right"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </tr>

        <tr></tr
      ></ng-container>

      <ng-container
        *ngFor="let item of items"
        matColumnDef="{{ item.property }}"
      >
        <th mat-header-cell *matHeaderCellDef>{{ item.header }}</th>
        <td mat-cell *matCellDef="let index = index">
          <jsonforms-outlet
          [renderProps]="index | getProps : item.props"
          ></jsonforms-outlet>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
    </table>
  `,
  styles: ['table {width: 100%;}', '.cdk-column-action { width: 15%}'],
})
export class TableRenderer extends JsonFormsArrayControl implements OnInit {
  detailUiSchema: UISchemaElement;
  displayedColumns: string[];
  items: ColumnDescription[];
  readonly columnsToIgnore = ['array', 'object'];
  addItem: (path: string, value: any) => () => void;
  moveItemUp: (path: string, index: number) => () => void;
  moveItemDown: (path: string, index: number) => () => void;
  removeItems: (path: string, toDelete: number[]) => () => void;
  translations: ArrayTranslations;

  constructor(jsonformsService: JsonFormsAngularService) {
    super(jsonformsService);
  }
  trackElement(index: number, _element: any) {
    return index ? index : null;
  }
  mapAdditionalProps(props: ArrayControlProps) {
    this.items = this.generateCells(props.schema, props.path);
    this.displayedColumns = this.items.map((item) => item.property);
    if (this.isEnabled()) {
      this.displayedColumns.push('action');
    }
    this.translations = props.translations;
  }
//   getProps(index: number, props: OwnPropsOfRenderer): OwnPropsOfRenderer {
//     const rowPath = Paths.compose(props.path, `${index}`);
//     return {
//       schema: props.schema,
//       uischema: props.uischema,
//       path: rowPath,
//     };
//   }

  remove(index: number): void {
    this.removeItems(this.propsPath, [index])();
  }
  add(): void {
    this.addItem(
      this.propsPath,
      createDefaultValue(this.scopedSchema, this.rootSchema)
    )();
  }
  up(index: number): void {
    this.moveItemUp(this.propsPath, index)();
  }
  down(index: number): void {
    this.moveItemDown(this.propsPath, index)();
  }
  ngOnInit() {
    super.ngOnInit();

    const { addItem, removeItems, moveUp, moveDown } =
      mapDispatchToArrayControlProps(
        this.jsonFormsService.updateCore.bind(this.jsonFormsService)
      );
    this.addItem = addItem;
    this.moveItemUp = moveUp;
    this.moveItemDown = moveDown;
    this.removeItems = removeItems;
  }

  generateCells = (
    schema: JsonSchema,
    rowPath: string
  ): ColumnDescription[] => {
    if (schema.type === 'object') {
      return this.getValidColumnProps(schema).map((prop) => {
        const encProp = encode(prop);
        const uischema = controlWithoutLabel(`#/properties/${encProp}`);
        if (!this.isEnabled()) {
          setReadonly(uischema);
        }
        return {
          property: prop,
          header: startCase(prop),
          props: {
            schema: schema,
            uischema,
            path: rowPath,
          },
        };
      });
    }
    // needed to correctly render input control for multi attributes
    return [
      {
        property: 'DUMMY',
        header: this.label,
        props: {
          schema: schema,
          uischema: controlWithoutLabel(`#`),
          path: rowPath,
        },
      },
    ];
  };

  getValidColumnProps = (scopedSchema: JsonSchema) => {
    if (scopedSchema.type === 'object') {
      return Object.keys(scopedSchema.properties).filter((prop) => {
        const types = deriveTypes(scopedSchema.properties[prop]);
        if (types.length > 1) {
          return false;
        }
        return this.columnsToIgnore.indexOf(types[0]) === -1;
      });
    }
    // primitives
    return [''];
  };
}
export const TableRendererTester: RankedTester = rankWith(
  3,
  or(isObjectArrayControl, isPrimitiveArrayControl)
);

interface ColumnDescription {
  property: string;
  header: string;
  props: OwnPropsOfRenderer;
}

export const controlWithoutLabel = (scope: string): ControlElement => ({
  type: 'Control',
  scope: scope,
  label: false,
});

@Pipe({ name: 'getProps' })
export class GetProps implements PipeTransform {
  transform(index: number, props: OwnPropsOfRenderer) {
    const rowPath = Paths.compose(props.path, `${index}`);
    console.log("250");
    return {
      schema: props.schema,
      uischema: props.uischema,
      path: rowPath,
    };
  }
}