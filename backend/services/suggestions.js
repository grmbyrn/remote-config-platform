import {isValidValue} from '../lib/validate.js'
import {normalizeCountry} from '../lib/country.js'

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

function buildPrompt({type, defaultValue, description, countries}){
    return [
        "You suggest country-specific values for a mobile app config parameter.",
        `Description: ${description || "(none)"}`,
        `Value type: ${type}`,
        `Default value: ${JSON.stringify(defaultValue)}`,
        `Target countries (ISO two-letter codes): ${countries.join(", ")}`,
        "",
        `Return ONLY a JSON object mapping each country code to a suggested value of type ${type}.`,
        "For json type, each value must be a JSON-encoded string. No prose, no code fences.",
    ].join('\n')
}

export async function generateSuggestions({type, defaultValue, description, countries}){
    const apiKey = process.env.ANTHROPIC_API_KEY
    if(!apiKey){
        const err = new Error("ANTHROPIC_API_KEY is not set")
        err.code = "NO_API_KEY"
        throw err
    }

    const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
            model: "claude-haiku-4-5",
            max_tokens: 1024,
            messages: [{role: "user", content: buildPrompt({type, defaultValue, description, countries})}]
        })
    })

    if(!res.ok){
        const err = new Error(`Anthropic request failed: ${res.status}`)
        err.code = "AI_REQUEST_FAILED"
        throw err
    }

    const data = await res.json()
    const text = data.content.find((b) => b.type === "text")?.text ?? ''

    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    const json = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text

    let parsed
    try {
        parsed = JSON.parse(json)
    } catch {
        const err = new Error("Model did not return valid JSON")
        err.code = "AI_BAD_OUTPUT"
        throw err
    }

    const valid = {}
    for(const [country, value] of Object.entries(parsed)){
        if(isValidValue(type, value)){
            valid[normalizeCountry(country)] = {
                value,
                model: data.model,
                generatedAt: new Date().toISOString(),
                status: 'pending'
            }
        }
    }
    return valid
}