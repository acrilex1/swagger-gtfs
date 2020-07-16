import * as fs from "fs";
// @ts-ignore
import { write } from "node-yaml";
import TurndownService from "turndown";

interface Asset {
  fileName: string;
  description?: string;
  properties: [
    {
      fieldName: string;
      type: string;
      required: boolean;
      description: string;
    }
  ];
}

interface OpenAPIProperty {
  type?: string;
  minimum?: number;
  maximum?: number;
  $ref?: string;
  format?: string;
  enum?: string[];
  pattern?: string;
  description?: string;
  oneOf?: OpenAPIProperty[];
  allOf?: OpenAPIProperty[];
}

interface OpenAPIObject {
  [assetName: string]: {
    description?: string;
    type: string;
    required: string[];
    properties: {
      [propertyName: string]: OpenAPIProperty;
    };
  };
}

// Helper functions for string
String.prototype.snakeToCamel = function (): string {
  return this.replace(/(_\w)/g, (m: string) => m[1].toUpperCase());
};

String.prototype.capitalize = function (): string {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

declare global {
  interface String {
    snakeToCamel(): string;
    capitalize(): string;
  }
}

class Parser {
  private assets: Asset[] = [];
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService();
  }

  public async parse() {
    const json = fs.readFileSync("src/documentation.json").toString();

    const formattedAssets: OpenAPIObject = {};

    this.assets = JSON.parse(json);
    this.assets.forEach((asset) => {
      const formattedProperties: OpenAPIObject["assetName"]["properties"] = {};
      asset.properties.forEach((property) => {
        formattedProperties[property.fieldName] = this.parseProperty(property);
      });

      formattedAssets[asset.fileName.snakeToCamel().capitalize()] = {
        type: "object",
        required: asset.properties
          .filter((property) => property.required)
          .map((property) => property.fieldName),
        properties: formattedProperties,
      };
    });

    await write("output.yaml", formattedAssets);
  }

  private parseProperty(property: Asset["properties"]["0"]): OpenAPIProperty {
    const result: OpenAPIProperty = {};

    // Removes referencing
    if (/.*ID.*/.test(property.type)) {
      property.type = "ID";
    }

    switch (
      property.type.toLowerCase() // Doc is inconsistent for uppercase/lowercase
    ) {
      case "color":
        result.type = "string";
        result.format = "hex";
        break;
      case "currency code":
        result.type = "string";
        result.format = "ISO 4217";
        break;
      case "date":
        result.type = "string";
        result.format = "date";
        break;
      case "email":
        result.type = "string";
        result.format = "email";
        break;
      case "enum":
        result.type = "string";
        result.enum = [];
        break;
      case "id":
        result.type = "string";
        break;
      case "language code":
        result.type = "string";
        result.format = "IETF BCP 47";
        break;
      case "latitude":
        result.type = "number";
        result.format = "double";
        result.minimum = -90.0;
        result.maximum = 90.0;
        break;
      case "longitude":
        result.type = "number";
        result.format = "double";
        result.minimum = -180.0;
        result.maximum = 180.0;
        break;
      case "positive float":
        result.minimum = 1;
      case "non-negative float":
        result.minimum = 0;
      case "float":
        result.type = "number";
        result.format = "float";
        break;
      case "positive integer":
        result.type = "integer";
        result.minimum = 1;
      case "non-negative integer":
        result.type = "integer";
        result.minimum = 0;
        break;
      case "non-null integer": // No way in swagger to prohibit 0
        result.format = "non-zero";
      case "integer":
        result.type = "integer";
        break;
      case "phone number":
        result.type = "string";
        result.format = "phone";
        break;
      case "time":
        result.type = "string";
        result.format = 'Time from "noon minus 12h", 24h+ format';
        result.pattern = "^\\d{1,2}:\\d{2}:\\d{2}$";
        break;
      case "text":
        result.type = "string";
        break;
      case "timezone":
        result.type = "string";
        result.format = "tz";
        result.pattern = "^[w/]*$";
        break;
      case "url":
        result.type = "string";
        result.format = "url";
        break;
      case "text, url, email, or phone number":
        result.oneOf = [
          {
            type: "string",
          },
          {
            type: "string",
            format: "url",
          },
          {
            type: "string",
            format: "email",
          },

          {
            type: "string",
            format: "phone",
          },
        ];
        break;
      default:
        throw new Error(`Invalid format ${property.type}`);
    }

    // Parse the description into Markdown
    result.description = this.turndownService.turndown(
      `${property.description}`
    );

    return result;
  }
}

new Parser().parse();
