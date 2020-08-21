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
      color: {
        type: "string",
        format: "hex",
        pattern: "/^[A-F0-9]{6}$/",
        example: "FFFFFF",
      },
      currency_code: {
        type: "string",
        format: "ISO 4217",
        "x-faker": "finance.currencyCode",
        example: "CAD",
      },
      date: {
        type: "string",
        format: "date",
        example: "20180913",
      },
      email: {
        type: "string",
        format: "email",
        "x-faker": "internet.exampleEmail",
        example: "example@example.com",
      },
      language_code: {
        type: "string",
        format: "IETF BCP 47",
        "x-faker": "random.locale",
        example: "en-US",
      },
      latitude: {
        type: "number",
        format: "double",
        minimum: -90.0,
        maximum: 90.0,
        "x-faker": "address.latitude",
        example: 41.890169,
      },
      longitude: {
        type: "number",
        format: "double",
        minimum: -180.0,
        maximum: 180.0,
        "x-faker": "address.longitude",
        example: 12.492269,
      },
      multi_day_time: {
        type: "string",
        format: 'Time from "noon minus 12h", 24h+ format',
        pattern: "^\\d{2}:[0-5][0-9]$",
        example: "25:35:00",
      },
      non_negative_float: {
        minimum: 0,
        type: "number",
        format: "float",
      },
      non_negative_integer: {
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
      phone_number: {
        type: "string",
        format: "phone",
        "x-faker": "phone.phoneNumber",
      },
      positive_float: {
        minimum: 1,
        type: "number",
        format: "float",
      },
      positive_integer: {
        type: "integer",
        minimum: 1,
      },
      text: {
        description: "Human-readable text",
        type: "string",
        "x-faker": "lorem.paragraph",
      },
      timezone: {
        type: "string",
        format: "tz",
        pattern: "^[w/]*$",
        example: "America/Los_Angeles",
      },
      url: {
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

      formattedAssets[asset.fileName] = {
        type: "object",
        required: asset.properties
          .filter((property) => property.required)
          .map((property) => property.fieldName),
        properties: formattedProperties,
      };
    });

    const definition = {
      openapi: "3.0.3",
      info: {
        version: "1.0.0",
        title: "GTFS generated models",
        description:
          "Models generated using https://github.com/alexandre-okidoo/gtfs-doc-parser by Alexandre Croteau\n\nPortions of this document are reproduced from work created and shared by Google and used according to terms described in the Creative Commons 4.0 Attribution License. Original documentation on which this document is based is available at and available at https://developers.google.com/transit/gtfs/reference",
        license: {
          name: "Creative Commons Attribution 4.0",
          url: "https://creativecommons.org/licenses/by/4.0/",
        },
      },
      paths: {},
      components: { schemas: formattedAssets },
    };

    await write("../openapi-gtfs.yaml", definition);
  }

  private parseProperty(property: Asset["properties"]["0"]): OpenAPIProperty {
    // Removes referencing
    if (/.*ID.*/.test(property.type)) {
      property.type = "ID";
    }

    const typesMapping: { [index: string]: OpenAPIProperty } = {
      color: { $ref: "#/components/schemas/color" },
      "currency code": { $ref: "#/components/schemas/currency_code" },
      date: { $ref: "#/components/schemas/date" },
      email: { $ref: "#/components/schemas/email" },
      enum: {
        type: "string",
        enum: [],
      },
      id: {
        type: "string",
      },
      "language code": {
        $ref: "#/components/schemas/language_code",
      },

      latitude: {
        $ref: "#/components/schemas/latitude",
      },
      longitude: {
        $ref: "#/components/schemas/longitude",
      },
      "positive float": {
        $ref: "#/components/schemas/positive_float",
      },
      "non-negative float": {
        $ref: "#/components/schemas/non_negative_float",
      },
      float: {
        type: "number",
        format: "float",
      },
      "positive integer": {
        $ref: "#/components/schemas/positive_integer",
      },
      "non-negative integer": {
        $ref: "#/components/schemas/non_negative_integer",
      },
      "non-null integer": {
        $ref: "#/components/schemas/non_null_integer",
      },
      integer: {
        type: "integer",
      },
      "phone number": {
        $ref: "#/components/schemas/phone_number",
      },
      time: {
        $ref: "#/components/schemas/multi_day_time",
      },
      text: {
        $ref: "#/components/schemas/text",
      },
      timezone: {
        $ref: "#/components/schemas/timezone",
      },
      url: {
        $ref: "#/components/schemas/url",
      },
      "text, url, email, or phone number": {
        oneOf: [
          {
            $ref: "#/components/schemas/text",
          },
          {
            $ref: "#/components/schemas/url",
          },
          {
            $ref: "#/components/schemas/email",
          },

          {
            $ref: "#/components/schemas/phone_number",
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
