import * as faker from "faker";
import {PscEvent} from "../../eventTypes";

export const generateFakePscEvent: () => PscEvent.PscEvent = () => {
    return (
        {
            "data": {
                "address": {
                    "address_line_1": faker.address.streetAddress(),
                    "address_line_2": faker.address.secondaryAddress(),
                    "care_of": "string",
                    "country": faker.address.country(),
                    "locality": faker.address.county(),
                    "po_box": faker.address.zipCode(),
                    "postal_code": faker.address.zipCodeByState('CO'),
                    "premises": faker.address.secondaryAddress(),
                    "region": faker.address.county()
                },
                "ceased": faker.random.boolean(),
                "ceased_on": faker.date.past().toDateString(),
                "country_of_residence": faker.address.country(),
                "date_of_birth": {
                    "day": faker.random.number(31),
                    "month": faker.random.number(12),
                    "year": faker.random.number(2020)
                },
                "description": 'super-secure-persons-with-significant-control',
                "etag": faker.random.uuid(),
                "identification": {
                    "country_registered": faker.address.country(),
                    "legal_authority": "string",
                    "legal_form": "string",
                    "place_registered": "string",
                    "registration_number": faker.random.uuid()
                },
                "kind": faker.random.arrayElement(['individual-person-with-significant-control',
                    'corporate-entity-person-with-significant-control',
                    'legal-person-with-significant-control',
                    'super-secure-person-with-significant-control']),
                "links": {
                    "self": "/company/" + faker.random.number({
                        min: 999999,
                        max: 13999999
                    }).toString().padStart(8, '0') + "/charges",
                    "statement": faker.internet.url()
                },
                "name": faker.name.findName(),
                "name_elements": {
                    "forename": faker.name.firstName(),
                    "other_forenames": faker.name.firstName(),
                    "surname": faker.name.lastName(),
                    "title": faker.name.prefix()
                },
                "nationality": "string",
                "natures_of_control":
                    faker.random.arrayElements(["ownership-of-shares-50-to-75-percent", "voting-rights-50-to-75-percent", "right-to-appoint-and-remove-directors"])
                ,
                "notified_on": faker.date.past().toDateString()
            },
            "event": {
                "fields_changed": [
                    "string"
                ],
                "published_at": faker.date.recent().toString(),
                "timepoint": faker.random.number(),
                "type": faker.random.arrayElement(['changed', 'deleted'])
            },
            "resource_id": faker.random.uuid(),
            "resource_kind": "charges",
            "resource_uri": "/company/" + faker.random.number() + "/charges"
        }
    )
}
