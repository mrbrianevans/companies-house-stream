import { FilingEvent } from "./types/eventTypes";
import { listenToStream, streamGenerator } from "./listenOnStream";


export const StreamFilings = (io, mode: "test" | "live") => {
  if (mode == "test") {
    setTimeout(async () => {
      io.emit(
        "event",
        sampleFilingEvents[
          Math.floor(Math.random() * sampleFilingEvents.length)
          ]
      );
      StreamFilings(io, "test");
    }, Math.random() * 2000);
  } else {
    listenToStream<FilingEvent.FilingEvent>("filings", event => {
      io.emit("event", event);
    });
  }
};

export async function AsyncStreamFilings(io) {
  for await(const event of streamGenerator("filings"))
    io.emit("event", event);
}

/**
 * Permanently reconnect to filing stream when stream ends
 */
export async function PermFilings(io) {
  while (true) {
    await AsyncStreamFilings(io);
  }
}

//test types with a real record:
const sampleFilingEvents: FilingEvent.FilingEvent[] = [
  {
    resource_kind: "filing-history",
    resource_uri: "/company/10676322/filing-history/MzI4OTQzODc5MGFkaXF6a2N4",
    resource_id: "MzI4OTQzODc5MGFkaXF6a2N4",
    data: {
      barcode: "X9WQX0NE",
      category: "accounts",
      date: "2021-01-22",
      description: "accounts-with-accounts-type-micro-entity",
      description_values: {
        made_up_date: "2020-03-31",
      },
      links: {
        self: "/company/10676322/filing-history/MzI4OTQzODc5MGFkaXF6a2N4",
      },
      transaction_id: "MzI4OTQzODc5MGFkaXF6a2N4",
      type: "AA",
    },
    event: {
      timepoint: 48990574,
      published_at: "2021-01-22T18:28:02",
      type: "changed",
    },
  },
  {
    resource_kind: "filing-history",
    resource_uri: "/company/07260025/filing-history/MzI2NTIzNzU0N2FkaXF6a2N4",
    resource_id: "MzI2NTIzNzU0N2FkaXF6a2N4",
    data: {
      annotations: [
        {
          annotation:
            "Clarification A SECOND FILED CS01 STATEMENT OF CAPITAL \u0026 SHAREHOLDER INFORMATION WAS REGISTERED ON 25/01/21",
          category: "annotation",
          date: "2021-01-25",
          description: "annotation",
          description_values: {
            description:
              "Clarification a second filed CS01 statement of capital \u0026 shareholder information was registered on 25/01/21",
          },
          type: "ANNOTATION",
        },
      ],
      barcode: "X95HGATK",
      category: "confirmation-statement",
      date: "2020-05-20",
      description: "confirmation-statement",
      description_values: {
        original_description: "20/05/20 Statement of Capital gbp 126",
      },
      links: {
        document_metadata:
          "https://frontend-doc-api.companieshouse.gov.uk/document/TsRu1rGfoPfqgDJB2RvUReq1XPkdrjvr302RHkUW_ww",
        self: "/company/07260025/filing-history/MzI2NTIzNzU0N2FkaXF6a2N4",
      },
      pages: 5,
      paper_filed: true,
      transaction_id: "MzI2NTIzNzU0N2FkaXF6a2N4",
      type: "CS01",
    },
    event: {
      timepoint: 49098961,
      published_at: "2021-01-25T13:32:01",
      type: "changed",
    },
  },
  {
    resource_kind: "filing-history",
    resource_uri: "/company/12114535/filing-history/MzI4MDM0NDI4NGFkaXF6a2N4",
    resource_id: "MzI4MDM0NDI4NGFkaXF6a2N4",
    data: {
      annotations: [
        {
          annotation:
            "Clarification A SECOND FILED CS01 STATEMENT OF CAPITAL \u0026 SHAREHOLDER INFORMATION WAS REGISTERED ON 25/01/21",
          category: "annotation",
          date: "2021-01-25",
          description: "annotation",
          description_values: {
            description:
              "Clarification a second filed CS01 statement of capital \u0026 shareholder information was registered on 25/01/21",
          },
          type: "ANNOTATION",
        },
      ],
      barcode: "X9FIEB6B",
      category: "confirmation-statement",
      date: "2020-10-12",
      description: "confirmation-statement",
      description_values: {
        original_description: "21/07/20 Statement of Capital eur 38000001",
      },
      links: {
        document_metadata:
          "https://frontend-doc-api.companieshouse.gov.uk/document/2IPexI9Xo_VfyzWXITSO4cQ7LvDWwN4U24rNeUlCBHE",
        self: "/company/12114535/filing-history/MzI4MDM0NDI4NGFkaXF6a2N4",
      },
      pages: 4,
      paper_filed: true,
      transaction_id: "MzI4MDM0NDI4NGFkaXF6a2N4",
      type: "CS01",
    },
    event: {
      timepoint: 49096881,
      published_at: "2021-01-25T13:16:02",
      type: "changed",
    },
  },
  {
    resource_kind: "filing-history",
    resource_uri: "/company/12317301/filing-history/MzI4MzUzMjgyMGFkaXF6a2N4",
    resource_id: "MzI4MzUzMjgyMGFkaXF6a2N4",
    data: {
      annotations: [
        {
          annotation:
            "Clarification A second filed CS01  (Statement of capital change and Shareholder information change) was registered on 25/01/2021.",
          category: "annotation",
          date: "2021-01-25",
          description: "annotation",
          description_values: {
            description:
              "Clarification a second filed CS01 (Statement of capital change and Shareholder information change) was registered on 25/01/2021.",
          },
          type: "ANNOTATION",
        },
      ],
      barcode: "X9HYDHPL",
      category: "confirmation-statement",
      date: "2020-11-16",
      description: "confirmation-statement",
      description_values: {
        original_description: "14/11/20 Statement of Capital gbp 300.00",
      },
      links: {
        document_metadata:
          "https://frontend-doc-api.companieshouse.gov.uk/document/Hl5VNNqB7HnAUZN1K9ugcwewb9ydUjF9nRJLaZlY1mA",
        self: "/company/12317301/filing-history/MzI4MzUzMjgyMGFkaXF6a2N4",
      },
      pages: 5,
      paper_filed: true,
      transaction_id: "MzI4MzUzMjgyMGFkaXF6a2N4",
      type: "CS01",
    },
    event: {
      timepoint: 49095333,
      published_at: "2021-01-25T13:04:04",
      type: "changed",
    },
  },
  {
    resource_kind: "filing-history",
    resource_uri: "/company/12317301/filing-history/MzI4MzUzMjgyMGFkaXF6a2N4",
    resource_id: "MzI4MzUzMjgyMGFkaXF6a2N4",
    data: {
      barcode: "X9HYDHPL",
      category: "confirmation-statement",
      date: "2020-11-16",
      description: "confirmation-statement",
      description_values: {
        original_description: "14/11/20 Statement of Capital gbp 300.00",
      },
      links: {
        document_metadata:
          "https://frontend-doc-api.companieshouse.gov.uk/document/Hl5VNNqB7HnAUZN1K9ugcwewb9ydUjF9nRJLaZlY1mA",
        self: "/company/12317301/filing-history/MzI4MzUzMjgyMGFkaXF6a2N4",
      },
      pages: 5,
      transaction_id: "MzI4MzUzMjgyMGFkaXF6a2N4",
      type: "CS01",
    },
    event: {
      timepoint: 49094846,
      published_at: "2021-01-25T13:01:04",
      type: "changed",
    },
  },
]
