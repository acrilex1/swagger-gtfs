import * as fs from "fs";
// @ts-ignore
import { write } from "node-yaml";
import TurndownService from "turndown";
import pluralize from "pluralize";

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
  example?: string | number | (string | number)[];
  oneOf?: OpenAPIProperty[];
  allOf?: OpenAPIProperty[];
  required?: string[];
  properties?: {
    [propertyName: string]: OpenAPIProperty;
  };
  // Additionnal properties for mock server
  "x-faker"?: string;
}

interface OpenAPIObject {
  [assetName: string]: OpenAPIProperty;
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

    const formattedAssets: OpenAPIObject = {
      Color: {
        type: "string",
        format: "hex",
        pattern: "/^[A-F0-9]{6}$/",
        example: "FFFFFF",
      },
      CurrencyCode: {
        type: "string",
        format: "ISO 4217",
        "x-faker": "finance.currencyCode",
        example: "CAD",
      },
      Date: {
        type: "string",
        format: "date",
        example: "20180913",
      },
      Email: {
        type: "string",
        format: "email",
        "x-faker": "internet.exampleEmail",
        example: "example@example.com",
      },
      LanguageCode: {
        type: "string",
        format: "IETF BCP 47",
        "x-faker": "random.locale",
        example: "en-US",
      },
      Latitude: {
        type: "number",
        format: "double",
        minimum: -90.0,
        maximum: 90.0,
        "x-faker": "address.latitude",
        example: 41.890169,
      },
      Longitude: {
        type: "number",
        format: "double",
        minimum: -180.0,
        maximum: 180.0,
        "x-faker": "address.longitude",
        example: 12.492269,
      },
      MultiDayTime: {
        type: "string",
        format: 'Time from "noon minus 12h", 24h+ format',
        pattern: "^\\d{2}:[0-5][0-9]$",
        example: "25:35:00",
      },
      NonNegativeFloat: {
        minimum: 0,
        type: "number",
        format: "float",
      },
      NonNegativeInteger: {
        type: "integer",
        minimum: 0,
      },
      NonNullInteger: {
        oneOf: [
          {
            type: "integer",
            minimum: 1,
          },
          {
            type: "integer",
            minimum: -1,
          },
        ],
      },
      PhoneNumber: {
        type: "string",
        format: "phone",
        "x-faker": "phone.phoneNumber",
      },
      PositiveFloat: {
        minimum: 1,
        type: "number",
        format: "float",
      },
      PositiveInteger: {
        type: "integer",
        minimum: 1,
      },
      Text: {
        description: "Human-readable text",
        type: "string",
        "x-faker": "lorem.paragraph",
      },
      Timezone: {
        type: "string",
        format: "tz",
        pattern: "^[w/]*$",
        example: "America/Los_Angeles",
      },
      URL: {
        type: "string",
        format: "url",
        "x-faker": "internet.url",
      },
    };

    this.assets = JSON.parse(json);
    this.assets.forEach((asset) => {
      const formattedProperties: OpenAPIObject["assetName"]["properties"] = {};
      asset.properties.forEach((property) => {
        formattedProperties[property.fieldName] = this.parseProperty(property);
      });

      formattedAssets[
        pluralize.singular(asset.fileName.snakeToCamel().capitalize())
      ] = {
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
    // Removes referencing
    if (/.*ID.*/.test(property.type)) {
      property.type = "ID";
    }

    const typesMapping: { [index: string]: OpenAPIProperty } = {
      color: { $ref: "#/Color" },
      "currency code": { $ref: "#/CurrencyCode" },
      date: { $ref: "#/Date" },
      email: { $ref: "#/Email" },
      enum: {
        type: "string",
        enum: [],
      },
      id: {
        type: "string",
      },
      "language code": {
        $ref: "#/LanguageCode",
      },

      latitude: {
        $ref: "#/Latitude",
      },
      longitude: {
        $ref: "#/Longitude",
      },
      "positive float": {
        $ref: "#/PositiveFloat",
      },
      "non-negative float": {
        $ref: "#/NonNegativeFloat",
      },
      float: {
        type: "number",
        format: "float",
      },
      "positive integer": {
        $ref: "#/PositiveInteger",
      },
      "non-negative integer": {
        $ref: "#/NonNegativeInteger",
      },
      "non-null integer": {
        $ref: "#/NonNullInteger",
      },
      integer: {
        type: "integer",
      },
      "phone number": {
        $ref: "#/PhoneNumber",
      },
      time: {
        $ref: "#/MultiDayTime",
      },
      text: {
        $ref: "#/Text",
      },
      timezone: {
        $ref: "#/Timezone",
      },
      url: {
        $ref: "#/URL",
      },
      "text, url, email, or phone number": {
        oneOf: [
          {
            $ref: "#/Text",
          },
          {
            $ref: "#/URL",
          },
          {
            $ref: "#/Email",
          },

          {
            $ref: "#/PhoneNumber",
          },
        ],
      },
    };

    const result: OpenAPIProperty = typesMapping[property.type.toLowerCase()]; // Doc is inconsistent for uppercase/lowercase

    if (!result) {
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
