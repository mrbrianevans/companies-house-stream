import { CompanyProfileEvent } from "./types/eventTypes";
import { listenToStream, streamGenerator } from "./listenOnStream";

export const StreamCompanies = (io, mode: "test" | "live") => {
  if (mode == "test") {
    // setTimeout(()=>io.emit("heartbeat", {}), Math.random()*10000)
    setTimeout(async () => {
      io.emit(
        "event",
        sampleCompanyProfiles[
          Math.floor(Math.random() * sampleCompanyProfiles.length)
          ]
      );
      StreamCompanies(io, "test");
    }, Math.random() * 3000);
  } else {
    listenToStream<CompanyProfileEvent.CompanyProfileEvent>("companies", event => {
      io.emit("event", event);
    });
  }
};

export async function AsyncStreamCompanies(io) {
  for await(const event of streamGenerator("companies"))
    io.emit("event", event);
}

/**
 * Permanently reconnect to companies stream when stream ends
 */
export async function PermCompanies(io) {
  while (true) {
    await AsyncStreamCompanies(io);
  }
}

const companyTypeConversion = {
  "private-unlimited": "Private unlimited company",
  ltd: "Private limited company",
  plc: "Public limited company",
  "old-public-company": "Old public company",
  "private-limited-guarant-nsc-limited-exemption":
    "Private Limited Company by guarantee without share capital, use of 'Limited' exemption",
  "limited-partnership": "Limited partnership",
  "private-limited-guarant-nsc":
    "Private limited by guarantee without share capital",
  "converted-or-closed": "Converted / closed",
  "private-unlimited-nsc": "Private unlimited company without share capital",
  "private-limited-shares-section-30-exemption":
    "Private Limited Company, use of 'Limited' exemption",
  "protected-cell-company": "Protected cell company",
  "assurance-company": "Assurance company",
  "oversea-company": "Overseas company",
  eeig: "European economic interest grouping (EEIG)",
  "icvc-securities": "Investment company with variable capital",
  "icvc-warrant": "Investment company with variable capital",
  "icvc-umbrella": "Investment company with variable capital",
  "registered-society-non-jurisdictional": "Registered society",
  "industrial-and-provident-society": "Industrial and Provident society",
  "northern-ireland": "Northern Ireland company",
  "northern-ireland-other": "Credit union (Northern Ireland)",
  llp: "Limited liability partnership",
  "royal-charter": "Royal charter company",
  "investment-company-with-variable-capital":
    "Investment company with variable capital",
  "unregistered-company": "Unregistered company",
  other: "Other company type",
  "european-public-limited-liability-company-se":
    "European public limited liability company (SE)",
  "uk-establishment": "UK establishment company",
  "scottish-partnership": "Scottish qualifying partnership",
  "charitable-incorporated-organisation":
    "Charitable incorporated organisation",
  "scottish-charitable-incorporated-organisation":
    "Scottish charitable incorporated organisation",
  "further-education-or-sixth-form-college-corporation":
    "Further education or sixth form college corporation"
}

// some sample companies from the stream to use as an example of the format to expect
const sampleCompanyProfiles: CompanyProfileEvent.CompanyProfileEvent[] = [
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "25",
          month: "03"
        },
        last_accounts: {
          made_up_to: "2020-03-29",
          period_end_on: "2020-03-29",
          period_start_on: "2019-03-30",
          type: "micro-entity"
        },
        next_accounts: {
          due_on: "2021-12-25",
          period_end_on: "2021-03-25",
          period_start_on: "2020-03-30"
        },
        next_due: "2021-12-25",
        next_made_up_to: "2021-03-25"
      },
      can_file: true,
      company_name: "BRIGHTSIDE PHOTOGRAPHY STUDIOS LTD",
      company_number: "10042347",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-03-02",
        next_due: "2022-03-16",
        next_made_up_to: "2022-03-02"
      },
      date_of_creation: "2016-03-03",
      etag: "c7e86b793689a80056dc19cf5fae83c6e99c6bba",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/10042347/filing-history",
        officers: "/company/10042347/officers",
        persons_with_significant_control:
          "/company/10042347/persons-with-significant-control",
        self: "/company/10042347"
      },
      registered_office_address: {
        address_line_1: "57a Bridge Street Row",
        country: "England",
        locality: "Chester",
        postal_code: "CH1 1NG"
      },
      sic_codes: ["74201"],
      type: "ltd"
    },
    resource_id: "10042347",
    event: {
      timepoint: 29800571,
      published_at: "2021-06-26T12:30:01",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/10042347"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "06"
        },
        last_accounts: {
          type: "null"
        },
        next_accounts: {
          due_on: "2023-03-26",
          period_end_on: "2022-06-30",
          period_start_on: "2021-06-26"
        },
        next_due: "2023-03-26",
        next_made_up_to: "2022-06-30"
      },
      can_file: true,
      company_name: "EXECUTIVE VIP SECURITY LTD",
      company_number: "13478899",
      company_status: "active",
      confirmation_statement: {
        next_due: "2022-07-09",
        next_made_up_to: "2022-06-25"
      },
      date_of_creation: "2021-06-26",
      etag: "71a499af924eaba07ba985fc6f13c3a2e57dbba9",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/13478899/filing-history",
        persons_with_significant_control:
          "/company/13478899/persons-with-significant-control",
        self: "/company/13478899"
      },
      registered_office_address: {
        address_line_1: "46 Rodney Way",
        country: "England",
        locality: "Ilkeston",
        postal_code: "DE7 8PW"
      },
      sic_codes: ["80100"],
      type: "ltd"
    },
    resource_id: "13478899",
    event: {
      timepoint: 29800572,
      published_at: "2021-06-26T12:30:02",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/13478899"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "06"
        },
        last_accounts: {
          made_up_to: "2020-06-30",
          period_end_on: "2020-06-30",
          period_start_on: "2019-07-01",
          type: "dormant"
        },
        next_accounts: {
          due_on: "2022-03-31",
          period_end_on: "2021-06-30",
          period_start_on: "2020-07-01"
        },
        next_due: "2022-03-31",
        next_made_up_to: "2021-06-30"
      },
      can_file: true,
      company_name: "TOP FLIGHT TRAVELS & TOURS LTD",
      company_number: "09616210",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-02-13",
        next_due: "2022-02-27",
        next_made_up_to: "2022-02-13"
      },
      date_of_creation: "2015-06-01",
      etag: "4577f010e70c4461f6170845ce33a8fa46d3dd65",
      jurisdiction: "england-wales",
      last_full_members_list_date: "2016-06-01",
      links: {
        filing_history: "/company/09616210/filing-history",
        officers: "/company/09616210/officers",
        persons_with_significant_control:
          "/company/09616210/persons-with-significant-control",
        self: "/company/09616210"
      },
      registered_office_address: {
        address_line_1: "270 C 270a - 270d High Street North",
        country: "England",
        locality: "London",
        postal_code: "E12 6SB"
      },
      sic_codes: ["79909"],
      type: "ltd"
    },
    resource_id: "09616210",
    event: {
      timepoint: 29800573,
      published_at: "2021-06-26T12:30:03",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/09616210"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "09"
        },
        last_accounts: {
          made_up_to: "2020-09-30",
          period_end_on: "2020-09-30",
          period_start_on: "2019-10-01",
          type: "micro-entity"
        },
        next_accounts: {
          due_on: "2022-06-30",
          period_end_on: "2021-09-30",
          period_start_on: "2020-10-01"
        },
        next_due: "2022-06-30",
        next_made_up_to: "2021-09-30"
      },
      can_file: true,
      company_name: "PHASED NORTH LIMITED",
      company_number: "10364224",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2020-09-06",
        next_due: "2021-09-20",
        next_made_up_to: "2021-09-06"
      },
      date_of_creation: "2016-09-07",
      etag: "abd3b6f6bc6ac2a0658f4d6b48c9a0608a5f960c",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/10364224/filing-history",
        officers: "/company/10364224/officers",
        persons_with_significant_control:
          "/company/10364224/persons-with-significant-control",
        registers: "/company/10364224/registers",
        self: "/company/10364224"
      },
      registered_office_address: {
        address_line_1: "118a Windmill Street",
        country: "England",
        locality: "Gravesend",
        postal_code: "DA12 1BL",
        region: "Kent"
      },
      sic_codes: ["62020"],
      type: "ltd"
    },
    resource_id: "10364224",
    event: {
      timepoint: 29800574,
      published_at: "2021-06-26T12:30:02",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/10364224"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "06"
        },
        last_accounts: {
          type: "null"
        },
        next_accounts: {
          due_on: "2023-03-26",
          period_end_on: "2022-06-30",
          period_start_on: "2021-06-26"
        },
        next_due: "2023-03-26",
        next_made_up_to: "2022-06-30"
      },
      can_file: true,
      company_name: "KNIGHTSBRIDGE GB SERVICES LTD",
      company_number: "13478898",
      company_status: "active",
      confirmation_statement: {
        next_due: "2022-07-09",
        next_made_up_to: "2022-06-25"
      },
      date_of_creation: "2021-06-26",
      etag: "e8576293c36689ffe30b7ceca097e6849577af0a",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/13478898/filing-history",
        persons_with_significant_control:
          "/company/13478898/persons-with-significant-control",
        self: "/company/13478898"
      },
      registered_office_address: {
        address_line_1: "8 Dale Road",
        country: "England",
        locality: "Birmingham",
        postal_code: "B29 6AG"
      },
      sic_codes: ["62020"],
      type: "ltd"
    },
    resource_id: "13478898",
    event: {
      timepoint: 29800575,
      published_at: "2021-06-26T12:30:02",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/13478898"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "31",
          month: "05"
        },
        last_accounts: {
          made_up_to: "2021-05-31",
          period_end_on: "2021-05-31",
          period_start_on: "2020-06-01",
          type: "dormant"
        },
        next_accounts: {
          due_on: "2023-02-28",
          period_end_on: "2022-05-31",
          period_start_on: "2021-06-01"
        },
        next_due: "2023-02-28",
        next_made_up_to: "2022-05-31"
      },
      can_file: true,
      company_name: "MGB BUSINESS LIMITED",
      company_number: "05833756",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-02-05",
        next_due: "2022-02-19",
        next_made_up_to: "2022-02-05"
      },
      date_of_creation: "2006-05-31",
      etag: "578be48fc13a27ad0e78a8dc9488a1d3d6fcee04",
      jurisdiction: "england-wales",
      last_full_members_list_date: "2016-05-31",
      links: {
        filing_history: "/company/05833756/filing-history",
        officers: "/company/05833756/officers",
        persons_with_significant_control:
          "/company/05833756/persons-with-significant-control",
        self: "/company/05833756"
      },
      registered_office_address: {
        address_line_1: "Middlemarch Broomhill Lane",
        address_line_2: "Reepham",
        country: "England",
        locality: "Norwich",
        postal_code: "NR10 4QY"
      },
      sic_codes: ["71200"],
      type: "ltd"
    },
    resource_id: "05833756",
    event: {
      timepoint: 29800576,
      published_at: "2021-06-26T12:30:03",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/05833756"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "06"
        },
        last_accounts: {
          made_up_to: "2020-06-30",
          period_end_on: "2020-06-30",
          period_start_on: "2019-06-26",
          type: "micro-entity"
        },
        next_accounts: {
          due_on: "2022-03-31",
          period_end_on: "2021-06-30",
          period_start_on: "2020-07-01"
        },
        next_due: "2022-03-31",
        next_made_up_to: "2021-06-30"
      },
      can_file: true,
      company_name: "PAWSITIVE CANINE SERVICES 2 LTD",
      company_number: "SC634453",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2020-06-25",
        next_due: "2021-07-09",
        next_made_up_to: "2021-06-25"
      },
      date_of_creation: "2019-06-26",
      etag: "8d8c3d972dec65830a0ecc245358f52a7613994a",
      jurisdiction: "scotland",
      links: {
        filing_history: "/company/SC634453/filing-history",
        officers: "/company/SC634453/officers",
        persons_with_significant_control:
          "/company/SC634453/persons-with-significant-control",
        self: "/company/SC634453"
      },
      registered_office_address: {
        address_line_1: "Torridon House",
        address_line_2: "Torridon Lane",
        country: "Scotland",
        locality: "Rosyth",
        postal_code: "KY11 2EU"
      },
      sic_codes: ["96090"],
      type: "ltd"
    },
    resource_id: "SC634453",
    event: {
      timepoint: 29800577,
      published_at: "2021-06-26T12:30:02",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/SC634453"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "06"
        },
        last_accounts: {
          type: "null"
        },
        next_accounts: {
          due_on: "2023-03-26",
          period_end_on: "2022-06-30",
          period_start_on: "2021-06-26"
        },
        next_due: "2023-03-26",
        next_made_up_to: "2022-06-30"
      },
      can_file: true,
      company_name: "SNEAK N SUPPLY LTD.",
      company_number: "13478900",
      company_status: "active",
      confirmation_statement: {
        next_due: "2022-07-09",
        next_made_up_to: "2022-06-25"
      },
      date_of_creation: "2021-06-26",
      etag: "ae6424cba867756a403c173444c80c95b165655e",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/13478900/filing-history",
        persons_with_significant_control:
          "/company/13478900/persons-with-significant-control",
        self: "/company/13478900"
      },
      registered_office_address: {
        address_line_1: "66 Quebec Road",
        country: "England",
        locality: "Ilford",
        postal_code: "IG2 6AN"
      },
      sic_codes: ["47990"],
      type: "ltd"
    },
    resource_id: "13478900",
    event: {
      timepoint: 29800578,
      published_at: "2021-06-26T12:30:02",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/13478900"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "31",
          month: "07"
        },
        last_accounts: {
          made_up_to: "2020-07-31",
          period_end_on: "2020-07-31",
          period_start_on: "2019-08-01",
          type: "micro-entity"
        },
        next_accounts: {
          due_on: "2022-04-30",
          period_end_on: "2021-07-31",
          period_start_on: "2020-08-01"
        },
        next_due: "2022-04-30",
        next_made_up_to: "2021-07-31"
      },
      can_file: true,
      company_name: "ARMSTRONG ELECTRICAL (NE) LTD",
      company_number: "07266170",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-05-26",
        next_due: "2022-06-09",
        next_made_up_to: "2022-05-26"
      },
      date_of_creation: "2010-05-26",
      etag: "c2599db29245b0e3fac128f15126edfd98cfd886",
      jurisdiction: "england-wales",
      last_full_members_list_date: "2016-05-26",
      links: {
        filing_history: "/company/07266170/filing-history",
        officers: "/company/07266170/officers",
        persons_with_significant_control:
          "/company/07266170/persons-with-significant-control",
        self: "/company/07266170"
      },
      registered_office_address: {
        address_line_1: "6 Whitchurch Close",
        address_line_2: "Ingleby Barwick",
        country: "England",
        locality: "Stockton-On-Tees",
        postal_code: "TS17 5BD"
      },
      sic_codes: ["43210"],
      type: "ltd"
    },
    resource_id: "07266170",
    event: {
      timepoint: 29800579,
      published_at: "2021-06-26T12:30:03",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/07266170"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "31",
          month: "05"
        },
        last_accounts: {
          made_up_to: "2020-05-31",
          period_end_on: "2020-05-31",
          period_start_on: "2019-06-01",
          type: "micro-entity"
        },
        next_accounts: {
          due_on: "2022-02-28",
          period_end_on: "2021-05-31",
          period_start_on: "2020-06-01"
        },
        next_due: "2022-02-28",
        next_made_up_to: "2021-05-31"
      },
      can_file: true,
      company_name: "RETAIL CHOICE TRADING AS YOUR SHOP LTD",
      company_number: "11386706",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-05-26",
        next_due: "2022-06-09",
        next_made_up_to: "2022-05-26"
      },
      date_of_creation: "2018-05-29",
      etag: "8a9fac65e433dcfc0a215bd4e23410e42e302bde",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/11386706/filing-history",
        officers: "/company/11386706/officers",
        persons_with_significant_control:
          "/company/11386706/persons-with-significant-control",
        self: "/company/11386706"
      },
      registered_office_address: {
        address_line_1: "78 Lidgate Lane",
        country: "England",
        locality: "Dewsbury",
        postal_code: "WF13 2BZ"
      },
      sic_codes: ["47190"],
      type: "ltd"
    },
    resource_id: "11386706",
    event: {
      timepoint: 29800580,
      published_at: "2021-06-26T12:30:03",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/11386706"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "06"
        },
        last_accounts: {
          made_up_to: "2020-06-30",
          period_end_on: "2020-06-30",
          period_start_on: "2019-06-26",
          type: "unaudited-abridged"
        },
        next_accounts: {
          due_on: "2022-03-31",
          period_end_on: "2021-06-30",
          period_start_on: "2020-07-01"
        },
        next_due: "2022-03-31",
        next_made_up_to: "2021-06-30"
      },
      can_file: true,
      company_name: "DEARNSIDE SERVICE STATION LTD",
      company_number: "12071106",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2020-06-25",
        next_due: "2021-07-09",
        next_made_up_to: "2021-06-25"
      },
      date_of_creation: "2019-06-26",
      etag: "6c2cef6375d5abd8cbccc2c4920b37ab90e2209f",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/12071106/filing-history",
        officers: "/company/12071106/officers",
        persons_with_significant_control:
          "/company/12071106/persons-with-significant-control",
        self: "/company/12071106"
      },
      registered_office_address: {
        address_line_1: "Texaco Service Station",
        address_line_2: "Barnsley Road,Goldthorpe",
        country: "United Kingdom",
        locality: "Rotherham",
        postal_code: "S63 9AE",
        region: "South Yorkshire"
      },
      sic_codes: ["47300"],
      type: "ltd"
    },
    resource_id: "12071106",
    event: {
      timepoint: 29800581,
      published_at: "2021-06-26T12:30:04",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/12071106"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "09"
        },
        last_accounts: {
          made_up_to: "2020-09-30",
          period_end_on: "2020-09-30",
          period_start_on: "2019-10-01",
          type: "micro-entity"
        },
        next_accounts: {
          due_on: "2022-06-30",
          period_end_on: "2021-09-30",
          period_start_on: "2020-10-01"
        },
        next_due: "2022-06-30",
        next_made_up_to: "2021-09-30"
      },
      can_file: true,
      company_name: "BARBARA MARSHALL LTD.",
      company_number: "05295534",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2020-11-24",
        next_due: "2021-12-08",
        next_made_up_to: "2021-11-24"
      },
      date_of_creation: "2004-11-24",
      etag: "e0cde1b329a5193f897bc5c51a5fc98e642d031c",
      jurisdiction: "england-wales",
      last_full_members_list_date: "2015-11-24",
      links: {
        filing_history: "/company/05295534/filing-history",
        officers: "/company/05295534/officers",
        persons_with_significant_control:
          "/company/05295534/persons-with-significant-control",
        self: "/company/05295534"
      },
      registered_office_address: {
        address_line_1: "27 Mortimer Street",
        country: "United Kingdom",
        locality: "London",
        postal_code: "W1T 3BL"
      },
      sic_codes: ["96090"],
      type: "ltd"
    },
    resource_id: "05295534",
    event: {
      timepoint: 29800582,
      published_at: "2021-06-26T12:30:04",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/05295534"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "31",
          month: "05"
        },
        last_accounts: {
          made_up_to: "2020-05-31",
          period_end_on: "2020-05-31",
          period_start_on: "2019-06-01",
          type: "total-exemption-full"
        },
        next_accounts: {
          due_on: "2022-02-28",
          period_end_on: "2021-05-31",
          period_start_on: "2020-06-01"
        },
        next_due: "2022-02-28",
        next_made_up_to: "2021-05-31"
      },
      can_file: true,
      company_name: "CJP SUPERSHEDS LIMITED",
      company_number: "09040676",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-05-15",
        next_due: "2022-05-29",
        next_made_up_to: "2022-05-15"
      },
      date_of_creation: "2014-05-15",
      etag: "83babe02ab24a0d984cb177bc29bd823345e1047",
      jurisdiction: "england-wales",
      last_full_members_list_date: "2016-05-15",
      links: {
        filing_history: "/company/09040676/filing-history",
        officers: "/company/09040676/officers",
        persons_with_significant_control:
          "/company/09040676/persons-with-significant-control",
        self: "/company/09040676"
      },
      registered_office_address: {
        address_line_1: "3 Pen Hafodlas Bach",
        locality: "Talysarn",
        postal_code: "LL54 6AN",
        region: "Gwynedd"
      },
      sic_codes: ["41202"],
      type: "ltd"
    },
    resource_id: "09040676",
    event: {
      timepoint: 29800583,
      published_at: "2021-06-26T12:30:05",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/09040676"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "31",
          month: "10"
        },
        last_accounts: {
          made_up_to: "2020-10-31",
          period_end_on: "2020-10-31",
          period_start_on: "2019-11-01",
          type: "dormant"
        },
        next_accounts: {
          due_on: "2022-07-31",
          period_end_on: "2021-10-31",
          period_start_on: "2020-11-01"
        },
        next_due: "2022-07-31",
        next_made_up_to: "2021-10-31"
      },
      can_file: true,
      company_name: "STALLION TWO LTD",
      company_number: "11603234",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2020-10-02",
        next_due: "2021-10-16",
        next_made_up_to: "2021-10-02"
      },
      date_of_creation: "2018-10-03",
      etag: "e20871f6e207574e401405f8edc78c4c874cc804",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/11603234/filing-history",
        officers: "/company/11603234/officers",
        persons_with_significant_control:
          "/company/11603234/persons-with-significant-control",
        self: "/company/11603234"
      },
      registered_office_address: {
        address_line_1: "Centre Court 1301 Stratford Road",
        address_line_2: "Hall Green",
        country: "United Kingdom",
        locality: "Birmingham",
        postal_code: "B28 9HH",
        region: "West Midlands"
      },
      sic_codes: ["68100"],
      type: "ltd"
    },
    resource_id: "11603234",
    event: {
      timepoint: 29800584,
      published_at: "2021-06-26T12:30:04",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/11603234"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "31",
          month: "10"
        },
        last_accounts: {
          made_up_to: "2020-10-31",
          period_end_on: "2020-10-31",
          period_start_on: "2019-11-01",
          type: "dormant"
        },
        next_accounts: {
          due_on: "2022-07-31",
          period_end_on: "2021-10-31",
          period_start_on: "2020-11-01"
        },
        next_due: "2022-07-31",
        next_made_up_to: "2021-10-31"
      },
      can_file: true,
      company_name: "COMESTA MINING CORPORATION LTD",
      company_number: "08733461",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2020-10-15",
        next_due: "2021-10-29",
        next_made_up_to: "2021-10-15"
      },
      date_of_creation: "2013-10-15",
      etag: "3e9a204f41183ea19edf5dd6ab876255b24fbbac",
      jurisdiction: "england-wales",
      last_full_members_list_date: "2015-10-15",
      links: {
        filing_history: "/company/08733461/filing-history",
        officers: "/company/08733461/officers",
        persons_with_significant_control:
          "/company/08733461/persons-with-significant-control",
        self: "/company/08733461"
      },
      registered_office_address: {
        address_line_1: "08733461: COMPANIES HOUSE DEFAULT ADDRESS",
        locality: "Cardiff",
        po_box: "4385",
        postal_code: "CF14 8LH"
      },
      registered_office_is_in_dispute: true,
      sic_codes: ["09900"],
      type: "ltd"
    },
    resource_id: "08733461",
    event: {
      timepoint: 29800585,
      published_at: "2021-06-26T12:30:04",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/08733461"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "31",
          month: "12"
        },
        last_accounts: {
          made_up_to: "2020-12-31",
          period_end_on: "2020-12-31",
          period_start_on: "2019-12-12",
          type: "dormant"
        },
        next_accounts: {
          due_on: "2022-09-30",
          period_end_on: "2021-12-31",
          period_start_on: "2021-01-01"
        },
        next_due: "2022-09-30",
        next_made_up_to: "2021-12-31"
      },
      can_file: true,
      company_name: "TECLINIC LTD",
      company_number: "12360707",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-06-23",
        next_due: "2022-07-07",
        next_made_up_to: "2022-06-23"
      },
      date_of_creation: "2019-12-12",
      etag: "6380fe02be53cb5af95578f2f1672d5c9ab98ebb",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/12360707/filing-history",
        officers: "/company/12360707/officers",
        persons_with_significant_control:
          "/company/12360707/persons-with-significant-control",
        self: "/company/12360707"
      },
      registered_office_address: {
        address_line_1: "31 Pike Drive",
        country: "England",
        locality: "Birmingham",
        postal_code: "B37 7FU"
      },
      sic_codes: ["47421", "47910", "95110", "95120"],
      type: "ltd"
    },
    resource_id: "12360707",
    event: {
      timepoint: 29800586,
      published_at: "2021-06-26T12:30:05",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/12360707"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "06"
        },
        last_accounts: {
          made_up_to: "2020-06-30",
          period_end_on: "2020-06-30",
          period_start_on: "2019-07-01",
          type: "micro-entity"
        },
        next_accounts: {
          due_on: "2022-03-31",
          period_end_on: "2021-06-30",
          period_start_on: "2020-07-01"
        },
        next_due: "2022-03-31",
        next_made_up_to: "2021-06-30"
      },
      can_file: true,
      company_name: "THE WOODBOURNE CONSULTANCY LIMITED",
      company_number: "04250226",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2020-07-11",
        next_due: "2021-07-25",
        next_made_up_to: "2021-07-11"
      },
      date_of_creation: "2001-07-11",
      etag: "288cad8a1161037048e9eafe5c1fef3115dc9a55",
      jurisdiction: "england-wales",
      last_full_members_list_date: "2015-07-11",
      links: {
        filing_history: "/company/04250226/filing-history",
        officers: "/company/04250226/officers",
        persons_with_significant_control:
          "/company/04250226/persons-with-significant-control",
        self: "/company/04250226"
      },
      registered_office_address: {
        address_line_1: "75 Woodbourne",
        address_line_2: "Augustus Road Edgbaston",
        locality: "Birmingham",
        postal_code: "B15 3PJ",
        region: "West Midlands"
      },
      sic_codes: ["82990"],
      type: "ltd"
    },
    resource_id: "04250226",
    event: {
      timepoint: 29800587,
      published_at: "2021-06-26T12:30:05",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/04250226"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "31",
          month: "10"
        },
        last_accounts: {
          made_up_to: "2020-10-31",
          period_end_on: "2020-10-31",
          period_start_on: "2019-11-01",
          type: "dormant"
        },
        next_accounts: {
          due_on: "2022-07-31",
          period_end_on: "2021-10-31",
          period_start_on: "2020-11-01"
        },
        next_due: "2022-07-31",
        next_made_up_to: "2021-10-31"
      },
      can_file: true,
      company_name: "THE IMAGINARY MADE REAL LTD",
      company_number: "11647257",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2020-10-28",
        next_due: "2021-11-11",
        next_made_up_to: "2021-10-28"
      },
      date_of_creation: "2018-10-29",
      etag: "91272db77912224b11dc6a4c384fde169f53788b",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/11647257/filing-history",
        officers: "/company/11647257/officers",
        persons_with_significant_control:
          "/company/11647257/persons-with-significant-control",
        self: "/company/11647257"
      },
      registered_office_address: {
        address_line_1: "Gemma House",
        address_line_2: "39 Lilestone Street",
        country: "United Kingdom",
        locality: "London",
        postal_code: "NW8 8SS"
      },
      sic_codes: ["90030"],
      type: "ltd"
    },
    resource_id: "11647257",
    event: {
      timepoint: 29800588,
      published_at: "2021-06-26T12:30:05",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/11647257"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "06"
        },
        last_accounts: {
          made_up_to: "2019-06-30",
          period_end_on: "2019-06-30",
          period_start_on: "2018-07-01",
          type: "total-exemption-full"
        },
        next_accounts: {
          due_on: "2021-06-30",
          period_end_on: "2020-06-30",
          period_start_on: "2019-07-01"
        },
        next_due: "2021-06-30",
        next_made_up_to: "2020-06-30"
      },
      can_file: true,
      company_name: "SHIFT PERSPECTIVE LTD",
      company_number: "10815788",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-06-12",
        next_due: "2022-06-26",
        next_made_up_to: "2022-06-12"
      },
      date_of_creation: "2017-06-13",
      etag: "944bb458958bbc5e13e05e4f05a1d4185d0dbb6b",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/10815788/filing-history",
        officers: "/company/10815788/officers",
        persons_with_significant_control:
          "/company/10815788/persons-with-significant-control",
        self: "/company/10815788"
      },
      registered_office_address: {
        address_line_1: "Three Oaks Main Road",
        address_line_2: "Worleston",
        country: "United Kingdom",
        locality: "Nantwich",
        postal_code: "CW5 6DN",
        region: "Cheshire"
      },
      sic_codes: ["70229"],
      type: "ltd"
    },
    resource_id: "10815788",
    event: {
      timepoint: 29800589,
      published_at: "2021-06-26T12:31:02",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/10815788"
  },
  {
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "06"
        },
        last_accounts: {
          made_up_to: "2020-06-30",
          period_end_on: "2020-06-30",
          period_start_on: "2019-07-01",
          type: "micro-entity"
        },
        next_accounts: {
          due_on: "2022-03-31",
          period_end_on: "2021-06-30",
          period_start_on: "2020-07-01"
        },
        next_due: "2022-03-31",
        next_made_up_to: "2021-06-30"
      },
      can_file: true,
      company_name: "BAREFOOT CERAMICS LIMITED",
      company_number: "05162525",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2020-06-11",
        next_due: "2021-06-25",
        next_made_up_to: "2021-06-11",
        overdue: true
      },
      date_of_creation: "2004-06-24",
      etag: "056ff0131daebbc319b5fdeabc9af1baab082a4d",
      jurisdiction: "england-wales",
      last_full_members_list_date: "2016-06-24",
      links: {
        filing_history: "/company/05162525/filing-history",
        officers: "/company/05162525/officers",
        persons_with_significant_control:
          "/company/05162525/persons-with-significant-control",
        self: "/company/05162525"
      },
      registered_office_address: {
        address_line_1: "48 Upton Road",
        country: "Wales",
        locality: "Newport",
        postal_code: "NP20 3EG"
      },
      sic_codes: ["90030", "90040"],
      type: "ltd"
    },
    resource_id: "05162525",
    event: {
      timepoint: 29800590,
      published_at: "2021-06-26T12:31:02",
      type: "changed"
    },
    resource_kind: "company-profile",
    resource_uri: "/company/05162525"
  },
  {
    resource_kind: "company-profile",
    resource_uri: "/company/05474296",
    resource_id: "05474296",
    data: {
      accounts: {
        accounting_reference_date: {
          day: "31",
          month: "03"
        },
        last_accounts: {
          made_up_to: "2020-03-31",
          period_end_on: "2020-03-31",
          period_start_on: "2019-04-01",
          type: "dormant"
        },
        next_accounts: {
          due_on: "2021-12-31",
          period_end_on: "2021-03-31",
          period_start_on: "2020-04-01"
        },
        next_due: "2021-12-31",
        next_made_up_to: "2021-03-31"
      },
      can_file: true,
      company_name: "BUTCHER'S ELECTRICAL SERVICES AND TECHNOLOGY LIMITED",
      company_number: "05474296",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-06-07",
        next_due: "2022-06-21",
        next_made_up_to: "2022-06-07"
      },
      date_of_creation: "2005-06-07",
      etag: "eaa1ff899627b0a784cb5926274308076ef1bf16",
      jurisdiction: "england-wales",
      last_full_members_list_date: "2016-06-07",
      links: {
        filing_history: "/company/05474296/filing-history",
        officers: "/company/05474296/officers",
        persons_with_significant_control:
          "/company/05474296/persons-with-significant-control",
        self: "/company/05474296"
      },
      registered_office_address: {
        address_line_1: "Unit 2/3 Chelworth Park Industrial Estate",
        address_line_2: "Cricklade",
        country: "England",
        locality: "Swindon",
        postal_code: "SN6 6HE",
        region: "Wiltshire"
      },
      sic_codes: ["43210"],
      type: "ltd"
    },
    event: {
      timepoint: 36940804,
      published_at: "2021-12-03T20:56:03",
      type: "changed"
    }
  },
  {
    resource_kind: "company-profile",
    resource_uri: "/company/12871145",
    resource_id: "12871145",
    data: {
      accounts: {
        accounting_reference_date: {
          day: "31",
          month: "03"
        },
        last_accounts: {
          type: "null"
        },
        next_accounts: {
          due_on: "2022-03-03",
          period_end_on: "2021-03-31",
          period_start_on: "2020-09-10"
        },
        next_due: "2022-03-03",
        next_made_up_to: "2021-03-31"
      },
      can_file: true,
      company_name: "TRIDENT IT SOLUTONS LTD",
      company_number: "12871145",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-09-09",
        next_due: "2022-09-23",
        next_made_up_to: "2022-09-09"
      },
      date_of_creation: "2020-09-10",
      etag: "be3fccc15b9107b83e69f362553240be9460abe3",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/12871145/filing-history",
        officers: "/company/12871145/officers",
        persons_with_significant_control:
          "/company/12871145/persons-with-significant-control",
        self: "/company/12871145"
      },
      registered_office_address: {
        address_line_1: "The Toll House, 115 High Street",
        country: "United Kingdom",
        locality: "Smethwick",
        postal_code: "B66 1AA",
        region: "West Midlands"
      },
      sic_codes: ["42990", "49410", "62090", "63990"],
      type: "ltd"
    },
    event: {
      timepoint: 36940805,
      published_at: "2021-12-03T20:56:03",
      type: "changed"
    }
  },
  {
    resource_kind: "company-profile",
    resource_uri: "/company/11656243",
    resource_id: "11656243",
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "11"
        },
        last_accounts: {
          made_up_to: "2020-11-30",
          period_end_on: "2020-11-30",
          period_start_on: "2019-12-01",
          type: "micro-entity"
        },
        next_accounts: {
          due_on: "2022-08-31",
          period_end_on: "2021-11-30",
          period_start_on: "2020-12-01"
        },
        next_due: "2022-08-31",
        next_made_up_to: "2021-11-30"
      },
      can_file: true,
      company_name: "NEESON ENTERPRISE LTD",
      company_number: "11656243",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-11-01",
        next_due: "2022-11-15",
        next_made_up_to: "2022-11-01"
      },
      date_of_creation: "2018-11-02",
      etag: "87f3198fcc54fe50db81044e3df488cc1e352e91",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/11656243/filing-history",
        officers: "/company/11656243/officers",
        persons_with_significant_control:
          "/company/11656243/persons-with-significant-control",
        self: "/company/11656243"
      },
      registered_office_address: {
        address_line_1: "7 Shaftesbury Lane",
        country: "United Kingdom",
        locality: "Coulsdon",
        postal_code: "CR5 3FS"
      },
      sic_codes: ["86230"],
      type: "ltd"
    },
    event: {
      timepoint: 36940806,
      published_at: "2021-12-03T20:56:03",
      type: "changed"
    }
  },
  {
    resource_kind: "company-profile",
    resource_uri: "/company/08379746",
    resource_id: "08379746",
    data: {
      accounts: {
        accounting_reference_date: {
          day: "31",
          month: "03"
        },
        last_accounts: {
          made_up_to: "2021-03-31",
          period_end_on: "2021-03-31",
          period_start_on: "2020-04-01",
          type: "micro-entity"
        },
        next_accounts: {
          due_on: "2022-12-31",
          period_end_on: "2022-03-31",
          period_start_on: "2021-04-01"
        },
        next_due: "2022-12-31",
        next_made_up_to: "2022-03-31"
      },
      can_file: true,
      company_name: "FDS CONCEPT LTD",
      company_number: "08379746",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-01-29",
        next_due: "2022-02-12",
        next_made_up_to: "2022-01-29"
      },
      date_of_creation: "2013-01-29",
      etag: "157d1f1462abf85e949a119e7ef3046d7b8b9fb2",
      jurisdiction: "england-wales",
      last_full_members_list_date: "2016-01-29",
      links: {
        filing_history: "/company/08379746/filing-history",
        officers: "/company/08379746/officers",
        persons_with_significant_control:
          "/company/08379746/persons-with-significant-control",
        self: "/company/08379746"
      },
      registered_office_address: {
        address_line_1: "5 The Spinney",
        address_line_2: "Weycombe Road",
        locality: "Haslemere",
        postal_code: "GU27 1SP",
        region: "Surrey"
      },
      sic_codes: ["86230"],
      type: "ltd"
    },
    event: {
      timepoint: 36940807,
      published_at: "2021-12-03T20:56:03",
      type: "changed"
    }
  },
  {
    resource_kind: "company-profile",
    resource_uri: "/company/13482485",
    resource_id: "13482485",
    data: {
      accounts: {
        accounting_reference_date: {
          day: "30",
          month: "06"
        },
        last_accounts: {
          type: "null"
        },
        next_accounts: {
          due_on: "2023-03-29",
          period_end_on: "2022-06-30",
          period_start_on: "2021-06-29"
        },
        next_due: "2023-03-29",
        next_made_up_to: "2022-06-30"
      },
      can_file: true,
      company_name: "OMEGA ACCOUNTANTS & BUSINESS ADVISORS LTD",
      company_number: "13482485",
      company_status: "active",
      confirmation_statement: {
        last_made_up_to: "2021-12-03",
        next_due: "2022-12-17",
        next_made_up_to: "2022-12-03"
      },
      date_of_creation: "2021-06-29",
      etag: "4bcc1d642c8c99d9cb0ef641922375e4178c48cb",
      jurisdiction: "england-wales",
      links: {
        filing_history: "/company/13482485/filing-history",
        officers: "/company/13482485/officers",
        persons_with_significant_control:
          "/company/13482485/persons-with-significant-control",
        self: "/company/13482485"
      },
      registered_office_address: {
        address_line_1: "119 Holloway Head",
        country: "England",
        locality: "Birmingham",
        postal_code: "B1 1QP"
      },
      sic_codes: ["96090"],
      type: "ltd"
    },
    event: {
      timepoint: 36940808,
      published_at: "2021-12-03T20:56:03",
      type: "changed"
    }
  }
]
