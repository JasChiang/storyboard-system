import type {
  Template,
  Composition,
  Layer,
  Variable,
  TextLayer,
  ShapeLayer,
  ImageLayer,
} from "../types/composition";

export class TemplateEngine {
  applyVariables(template: Template, values: Record<string, any>): Composition {
    const composition = this.cloneComposition(template.composition);

    for (const variable of template.variables) {
      const value = values[variable.name] ?? variable.defaultValue;

      for (const layerId of variable.targetLayerIds) {
        const layer = this.findLayerById(composition.layers, layerId);
        if (!layer) continue;

        this.applyVariableToLayer(layer, variable, value);
      }
    }

    return composition;
  }

  private cloneComposition(composition: Composition): Composition {
    return JSON.parse(JSON.stringify(composition));
  }

  private findLayerById(layers: Layer[], layerId: string): Layer | null {
    for (const layer of layers) {
      if (layer.id === layerId) {
        return layer;
      }

      if (layer.type === "group") {
        const childLayer = this.findLayerById(
          layers.filter((l) => layer.children?.includes(l.id)),
          layerId,
        );
        if (childLayer) return childLayer;
      }
    }
    return null;
  }

  private applyVariableToLayer(
    layer: Layer,
    variable: Variable,
    value: any,
  ): void {
    switch (variable.type) {
      case "text":
        this.applyTextVariable(layer as TextLayer, variable, value);
        break;
      case "color":
        this.applyColorVariable(layer, variable, value);
        break;
      case "image":
        this.applyImageVariable(layer as ImageLayer, variable, value);
        break;
      case "number":
        this.applyNumberVariable(layer, variable, value);
        break;
      case "boolean":
        this.applyBooleanVariable(layer, variable, value);
        break;
    }
  }

  private applyTextVariable(
    layer: TextLayer,
    variable: Variable,
    value: string,
  ): void {
    if (layer.type !== "text") return;

    if (variable.targetProperty === "content" || !variable.targetProperty) {
      layer.content = value;
    } else if (variable.targetProperty === "fontFamily") {
      layer.style.fontFamily = value;
    } else if (variable.targetProperty === "fontSize") {
      layer.style.fontSize = parseFloat(value);
    } else if (variable.targetProperty === "color") {
      layer.style.color = value;
    }
  }

  private applyColorVariable(
    layer: Layer,
    variable: Variable,
    value: string,
  ): void {
    if (!variable.targetProperty) return;

    if (layer.type === "shape") {
      const shapeLayer = layer as ShapeLayer;
      if (variable.targetProperty === "fill.color") {
        if (shapeLayer.fill.type === "solid") {
          shapeLayer.fill.color = value;
        }
      } else if (variable.targetProperty === "stroke.color") {
        if (shapeLayer.stroke) {
          shapeLayer.stroke.color = value;
        }
      }
    } else if (layer.type === "text") {
      const textLayer = layer as TextLayer;
      if (variable.targetProperty === "style.color") {
        textLayer.style.color = value;
      }
    }
  }

  private applyImageVariable(
    layer: ImageLayer,
    variable: Variable,
    value: string,
  ): void {
    if (layer.type !== "image") return;

    if (variable.targetProperty === "imageUrl" || !variable.targetProperty) {
      layer.imageUrl = value;
    }
  }

  private applyNumberVariable(
    layer: Layer,
    variable: Variable,
    value: number,
  ): void {
    if (!variable.targetProperty) return;

    const properties = variable.targetProperty.split(".");
    let target: any = layer;

    for (let i = 0; i < properties.length - 1; i++) {
      target = target[properties[i]];
      if (!target) return;
    }

    const finalProperty = properties[properties.length - 1];
    target[finalProperty] = value;
  }

  private applyBooleanVariable(
    layer: Layer,
    variable: Variable,
    value: boolean,
  ): void {
    if (!variable.targetProperty) return;

    const properties = variable.targetProperty.split(".");
    let target: any = layer;

    for (let i = 0; i < properties.length - 1; i++) {
      target = target[properties[i]];
      if (!target) return;
    }

    const finalProperty = properties[properties.length - 1];
    target[finalProperty] = value;
  }

  validateTemplate(template: Template): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!template.id || !template.name) {
      errors.push("Template must have an id and name");
    }

    if (!template.composition) {
      errors.push("Template must have a composition");
    }

    if (template.composition) {
      if (
        !template.composition.width ||
        !template.composition.height ||
        !template.composition.frameRate ||
        !template.composition.duration
      ) {
        errors.push(
          "Composition must have width, height, frameRate, and duration",
        );
      }

      if (
        !template.composition.layers ||
        template.composition.layers.length === 0
      ) {
        errors.push("Composition must have at least one layer");
      }
    }

    for (const variable of template.variables) {
      if (!variable.name || !variable.type || !variable.label) {
        errors.push(
          `Variable must have name, type, and label: ${JSON.stringify(variable)}`,
        );
      }

      if (!variable.targetLayerIds || variable.targetLayerIds.length === 0) {
        errors.push(`Variable ${variable.name} must target at least one layer`);
      }

      for (const layerId of variable.targetLayerIds) {
        const layer = this.findLayerById(template.composition.layers, layerId);
        if (!layer) {
          errors.push(
            `Variable ${variable.name} targets non-existent layer: ${layerId}`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  createTemplateFromComposition(
    composition: Composition,
    metadata: {
      name: string;
      description?: string;
      category: Template["category"];
      tags?: string[];
      thumbnailUrl: string;
    },
    variables: Variable[] = [],
  ): Template {
    return {
      id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      name: metadata.name,
      description: metadata.description,
      category: metadata.category,
      tags: metadata.tags || [],
      thumbnailUrl: metadata.thumbnailUrl,
      composition: this.cloneComposition(composition),
      variables,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: "1.0.0",
    };
  }
}

export const templateEngine = new TemplateEngine();
