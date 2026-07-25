"""Demo library content.

Real multi-page prose rather than lorem ipsum: the annotation features only
look like themselves when there is something worth annotating.
"""

from __future__ import annotations

from typing import Any


def p(text: str, block: str | None = None) -> dict[str, Any]:
    node: dict[str, Any] = {"type": "paragraph", "content": [{"type": "text", "text": text}]}
    if block:
        node["attrs"] = {"blockStyle": block}
    return node


def h(text: str, level: int = 2) -> dict[str, Any]:
    return {"type": "heading", "attrs": {"level": level}, "content": [{"type": "text", "text": text}]}


def quote(text: str) -> dict[str, Any]:
    return {"type": "blockquote", "content": [p(text)]}


def rule() -> dict[str, Any]:
    return {"type": "horizontalRule"}


def image(src: str, caption: str, align: str = "center", width: int = 100) -> dict[str, Any]:
    return {
        "type": "cartImage",
        "attrs": {
            "src": src,
            "alt": caption,
            "caption": caption,
            "align": align,
            "width": width,
            "wrap": False,
        },
    }


def doc(*blocks: dict[str, Any]) -> dict[str, Any]:
    return {"type": "doc", "content": list(blocks)}


# ---------------------------------------------------------------------------
# 1 — The Lamplighter's Almanac
# ---------------------------------------------------------------------------
LAMPLIGHTER = {
    "title": "The Lamplighter's Almanac",
    "subtitle": "Notes on cities that do not sleep",
    "description": (
        "Twelve years of walking home at night, written down. On the particular "
        "attention that only arrives after midnight, and what a city tells you "
        "when it thinks nobody is listening."
    ),
    "tags": ["essays", "cities", "night"],
    "cover": {
        "kind": "gradient",
        "gradient": ["#2B2118", "#100C08"],
        "angle": 155,
        "preset": "classic",
        "show_author": True,
    },
    "back": {
        "kind": "gradient",
        "gradient": ["#1E2A2A", "#0B1211"],
        "angle": 200,
        "preset": "classic",
        "text": (
            "There is a version of every city that only exists between one in the "
            "morning and first light. This is a record of that one."
        ),
    },
    "pages": [
        ("Before the lamps", [
            h("Before the lamps", 1),
            p(
                "The city does not go quiet at night. It changes register. The sounds that "
                "carry at two in the morning are the ones that were there all along and could "
                "not be heard over everything else — a shutter settling, water moving in a pipe "
                "three floors down, someone's radio through a wall."
            ),
            p(
                "I started walking home instead of taking the last train because I could not "
                "sleep, and I kept doing it for twelve years because I discovered that "
                "attention is cheaper at night. There is less to look at, so you look harder."
            ),
            quote(
                "Attention is not a resource you spend. It is a room you enter, and most of "
                "the day you are standing in the doorway."
            ),
            p(
                "This is not a book about insomnia. Insomnia is a medical fact and it is "
                "boring. This is a book about what is available to a person who is awake when "
                "the city assumes nobody is."
            ),
        ]),
        ("An inventory of light", [
            h("An inventory of light"),
            p(
                "Sodium: orange, forgiving, almost extinct. It made everyone look as though "
                "they had just come in from a fire. Cities replaced it with LED because sodium "
                "wastes light upward, into the sky, where nobody needs it — which is exactly "
                "what I liked about it."
            ),
            p(
                "LED: white, precise, unsentimental. It renders colour accurately and therefore "
                "renders three in the morning inaccurately. Nothing at that hour is the colour "
                "it is at noon."
            ),
            p(
                "Shopfront: the most honest light in any city, because it is on for nobody. A "
                "lit window at four a.m. with nothing behind it but mannequins and a floor "
                "somebody mopped."
            ),
            rule(),
            p(
                "I have come to think that a city's character is legible in what it leaves "
                "lit. Some cities light their monuments. Some light their roads. A very few "
                "light their trees, and those are the ones I would live in."
            ),
        ]),
        ("The hours have names", [
            h("The hours have names"),
            p(
                "Between eleven and one is the long tail of the evening — people going home "
                "from things, still carrying the mood of wherever they were. Between one and "
                "three is the true night, when whoever is out is out on purpose. Between three "
                "and five is the shift change, and it belongs to people working."
            ),
            p(
                "It took me years to notice that the last of these is the only hour in which "
                "the city is entirely populated by people who are being paid to be there. It "
                "is the least romantic hour and by far the most competent."
            ),
            p(
                "At five the birds start, absurdly, in the middle of the concrete, and the "
                "whole thing begins to come apart.",
            ),
            p(
                "A city at first light is embarrassing, like a room after a party. Best not to "
                "be there for it. Best to be indoors by then, with the curtains not quite "
                "closed, listening to the beginning of the noise you have just spent all night "
                "outside of.",
                "callout",
            ),
        ]),
        ("What the walk is for", [
            h("What the walk is for"),
            p(
                "People ask whether it is safe, and the honest answer is that it is safer than "
                "they think and less safe than I pretend. But that is not the interesting "
                "question. The interesting question is what the walking is for, and the answer "
                "took me most of a decade."
            ),
            p(
                "It is for the part of thinking that cannot be done sitting down. There is a "
                "kind of problem that dissolves the moment you stop trying to solve it and "
                "start moving through a landscape that requires nothing of you. Cities at night "
                "require nothing of you. That is the whole gift."
            ),
            quote(
                "Walk for long enough and the thought you were avoiding will catch up, "
                "out of breath, and sit down next to you."
            ),
            p(
                "I have written most of this book in my head between the bridge and the "
                "junction, and lost most of it again before I got home. What survives is what "
                "was worth surviving. That is as good an editorial process as any I know."
            ),
        ]),
    ],
}


# ---------------------------------------------------------------------------
# 2 — Marginalia
# ---------------------------------------------------------------------------
MARGINALIA = {
    "title": "Marginalia",
    "subtitle": "On writing in other people's books",
    "description": (
        "A short defence of the annotated book — the underline, the furious note, "
        "the question mark that outlives the reader who made it."
    ),
    "tags": ["reading", "essays", "books"],
    "cover": {
        "kind": "gradient",
        "gradient": ["#D9A05B", "#7A4E17"],
        "angle": 135,
        "preset": "modern",
        "title_color": "#1A1408",
        "show_author": True,
    },
    "back": {
        "kind": "color",
        "color": "#171613",
        "preset": "plate",
        "text": "A book you have not written in is a book you have not finished reading.",
    },
    "pages": [
        ("The case for the pencil", [
            h("The case for the pencil", 1),
            p(
                "There is a superstition that a book is damaged by being written in. It is a "
                "recent superstition and a snobbish one. For most of the history of the printed "
                "book, the margin was where the reading actually happened."
            ),
            p(
                "The medieval reader did not think of a page as finished. Neither did Coleridge, "
                "who wrote so much in other people's books that his friends lent him volumes "
                "specifically to get them back improved."
            ),
            quote(
                "A book you have not written in is a book you have not finished reading."
            ),
            p(
                "I am not arguing for defacement. I am arguing that the underline is a form of "
                "thought, and that thought which leaves no trace is difficult to distinguish "
                "from thought that did not happen."
            ),
        ]),
        ("Three kinds of mark", [
            h("Three kinds of mark"),
            p(
                "The first kind is the underline, which says only: this. It makes no argument. "
                "It is the reader's finger, left behind on the page."
            ),
            p(
                "The second is the note, which is a conversation with yourself at a later date. "
                "You will not remember writing it. You will find it years afterwards and be "
                "surprised by the company."
            ),
            p(
                "The third is the objection, and it is the most valuable of the three, because "
                "it is the only one that requires the reader to be present as somebody with "
                "something at stake. Agreement leaves no mark. Disagreement leaves a scar."
            ),
            rule(),
            p(
                "Every reading system I have ever used has been good at the first kind, "
                "tolerable at the second, and hopeless at the third — because the third needs "
                "somewhere to put an argument, and a highlight is not an argument."
            ),
        ]),
        ("The book that answers back", [
            h("The book that answers back"),
            p(
                "What I have always wanted is not a better highlighter. It is a book in which "
                "the objection I wrote in the margin can be read by the next person who reaches "
                "that line, and answered."
            ),
            p(
                "Not a review. A review is about the book. I want the thing that is about the "
                "sentence — the paragraph on page ninety-one that is either the best in the "
                "book or a sleight of hand, and about which two careful readers can reasonably "
                "come to blows."
            ),
            p(
                "A margin that other people can reach is a strange and slightly frightening "
                "idea. It means being read while reading. I think it is worth it.",
                "callout",
            ),
            p(
                "The alternative is what we have now: a million people underlining the same "
                "sentence in a million separate copies, none of them aware of the others, all "
                "of them alone with it."
            ),
        ]),
    ],
}


# ---------------------------------------------------------------------------
# 3 — Salt Lines
# ---------------------------------------------------------------------------
SALT_LINES = {
    "title": "Salt Lines",
    "subtitle": "A coast, in four tides",
    "description": (
        "Four years on a shrinking coastline, and what it is like to love a place "
        "that is measurably leaving."
    ),
    "tags": ["memoir", "sea", "place"],
    "cover": {
        "kind": "gradient",
        "gradient": ["#1C2130", "#090B12"],
        "angle": 170,
        "preset": "stamp",
        "show_author": True,
    },
    "back": {
        "kind": "gradient",
        "gradient": ["#2E2E2E", "#0E0E0E"],
        "angle": 150,
        "preset": "classic",
        "text": "The sea does not take the land all at once. That is the cruelty of it.",
    },
    "pages": [
        ("First tide", [
            h("First tide", 1),
            p(
                "The house was eleven metres from the edge when we bought it and nine when we "
                "left. Nobody hid this from us. It was in the survey, in a paragraph written "
                "in the flat voice that professionals use for facts they cannot soften."
            ),
            p(
                "The sea does not take the land all at once. That is the cruelty of it. It "
                "takes it in a way that lets you get used to each new distance, so that every "
                "year you are standing somewhere that would have terrified you the year before."
            ),
            quote("You do not notice a coast going. You notice having noticed."),
        ]),
        ("Second tide", [
            h("Second tide"),
            p(
                "There is a particular kind of neighbour who arrives with a folder. Ours was "
                "called Ellis and he had photographs going back to 1961, taken from the same "
                "spot on the same day every year, which is a form of devotion I did not "
                "recognise at first and now think about constantly."
            ),
            p(
                "He was not campaigning. He had no theory. He simply believed that somebody "
                "ought to be keeping the record, and that if nobody else was going to, it fell "
                "to whoever noticed first."
            ),
            p(
                "I have come to think this is what most useful work is: not a plan, but a "
                "person who noticed and then did not stop."
            ),
        ]),
        ("Third tide", [
            h("Third tide"),
            p(
                "The winter storm took four metres in a night, which is not remarkable — it "
                "happens along that coast every few years — but it took them from directly "
                "below the kitchen window, and afterwards the light in the room was different."
            ),
            p(
                "I did not expect that. Nobody tells you that erosion changes the light. There "
                "was more of it, and it was colder, and it came off the water at an angle that "
                "made the whole room feel provisional."
            ),
            p(
                "We stayed another two years. People asked why, and the honest answer is that "
                "we were not finished, and a place you are not finished with is very hard to "
                "leave on schedule.",
                "epigraph",
            ),
        ]),
        ("Fourth tide", [
            h("Fourth tide"),
            p(
                "Ellis died the spring before we moved. His daughter found the folder and did "
                "not know what it was. She very nearly threw it away, and told me so, laughing, "
                "in the way people laugh about the thing that frightened them."
            ),
            p(
                "It is in a county archive now. Sixty-one photographs, one a year, taken from "
                "the same spot, of a coast that is no longer there. It is the single most "
                "valuable document anybody produced about that stretch of shore, and it was "
                "made by a man with no qualifications and a good habit."
            ),
            quote(
                "Almost everything worth keeping was kept by somebody who had no particular "
                "reason to keep it."
            ),
        ]),
    ],
}


# ---------------------------------------------------------------------------
# 4 — A Field Guide to Forgetting
# ---------------------------------------------------------------------------
FORGETTING = {
    "title": "A Field Guide to Forgetting",
    "subtitle": "In defence of the leaky mind",
    "description": (
        "Everything written about memory assumes that more of it is better. This is "
        "an argument that forgetting is not the failure of memory but its method."
    ),
    "tags": ["essays", "memory", "science"],
    "cover": {
        "kind": "gradient",
        "gradient": ["#242A1E", "#0D1109"],
        "angle": 145,
        "preset": "plate",
        "show_author": True,
    },
    "back": {
        "kind": "gradient",
        "gradient": ["#2A1E24", "#120A0E"],
        "angle": 160,
        "preset": "classic",
        "text": "A mind that kept everything would not be a better mind. It would be an archive, and archives cannot think.",
    },
    "pages": [
        ("The wrong metaphor", [
            h("The wrong metaphor", 1),
            p(
                "We describe memory as storage, and every problem in the popular understanding "
                "of memory follows from that one word. Storage implies that the ideal is "
                "retention, that loss is failure, and that a perfect memory would be a full one."
            ),
            p(
                "But a mind that kept everything would not be a better mind. It would be an "
                "archive, and archives cannot think. Thinking is what happens when most of the "
                "material is gone and only the shape of it remains."
            ),
            quote(
                "Forgetting is not the failure of memory. It is the operation by which memory "
                "produces meaning."
            ),
        ]),
        ("What the case studies actually show", [
            h("What the case studies actually show"),
            p(
                "The famous cases of near-total recall are, without exception, accounts of "
                "difficulty. The detail arrives unbidden and undifferentiated. Every anniversary "
                "brings the whole of the original day back at full volume."
            ),
            p(
                "What these people describe is not a superpower. It is an inability to let the "
                "past become the past — which is to say, an inability to generalise, and "
                "generalising is most of what a mind is for."
            ),
            p(
                "Ask someone with an ordinary memory what their childhood kitchen was like and "
                "they will give you a kitchen that never existed: a composite, assembled from "
                "twelve years of Tuesdays. That composite is more useful than any single "
                "Tuesday, and it is built out of forgetting.",
                "callout",
            ),
        ]),
        ("A practical consequence", [
            h("A practical consequence"),
            p(
                "If forgetting is a method rather than a fault, then the question is not how to "
                "retain more but what to hand off. Writing things down is not a crutch. It is a "
                "division of labour between a system that is good at holding and a system that "
                "is good at connecting."
            ),
            p(
                "The margin of a book is the oldest such handoff we have. You are not recording "
                "the sentence — the sentence is already recorded, that is what the book is for. "
                "You are recording the collision between the sentence and you, which exists "
                "nowhere else and will not survive the week."
            ),
            p(
                "Keep the collision. Let the rest go. That is the whole practice.",
                "epigraph",
            ),
        ]),
    ],
}


BOOKS = [LAMPLIGHTER, MARGINALIA, SALT_LINES, FORGETTING]
