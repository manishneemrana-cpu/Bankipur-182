import type { Language, ProjectType } from "@ave/shared-types";

/**
 * Script template system.
 *
 * A template = an ordered list of "slots". Each slot has several wording variants per language;
 * one variant is chosen per slot using a seeded pick (same project -> same script, different
 * projects -> different phrasing). Templates are keyed by project type, so a plot reads as an
 * investment story, a tower as a skyline story, a villa as a lifestyle story, a 2/3BHK as a
 * family-home story.
 *
 * Copy rule: templates must NOT invent verifiable facts (RERA numbers, returns, possession dates,
 * prices, distances). Only use fields the broker supplied. Brokers can paste a custom script for
 * anything factual.
 *
 * Placeholders: {name} {builder} {tagline} {location} {type}
 */
export type Slot = Record<Language, string[]>;

export interface ScriptTemplate {
  id: string;
  label: string;
  types: ProjectType[];
  slots: { id: string; optionalIf?: "noTagline" | "noAmenities"; variants: Slot }[];
}

const hook: Slot = {
  en: ["Imagine a place that is made for your next chapter.", "Some addresses are simply destinations. Some become legacies.", "Every great story begins with the right location."],
  hi: ["सोचिए, एक ऐसी जगह जो आपके अगले अध्याय के लिए बनी हो।", "कुछ पते सिर्फ़ पते होते हैं, और कुछ विरासत बन जाते हैं।", "हर शानदार कहानी सही लोकेशन से शुरू होती है।"],
  hinglish: ["Socho, ek aisi jagah jo aapke next chapter ke liye bani ho.", "Kuch addresses sirf address hote hain, aur kuch legacy ban jaate hain.", "Har badi kahani sahi location se shuru hoti hai."],
};

const intro: Slot = {
  en: ["Introducing {name} by {builder}.", "Presenting {name}, a landmark from {builder}.", "Welcome to {name}, crafted by {builder}."],
  hi: ["प्रस्तुत है {builder} का {name}।", "मिलिए {name} से, जिसे बनाया है {builder} ने।", "{builder} के {name} में आपका स्वागत है।"],
  hinglish: ["Introducing {name} by {builder}.", "Presenting {name}, {builder} ka ek landmark project.", "Welcome to {name}, jise banaya hai {builder} ne."],
};

const tagline: Slot = {
  en: ["{tagline}", "{tagline}"],
  hi: ["{tagline}", "{tagline}"],
  hinglish: ["{tagline}", "{tagline}"],
};

const location: Slot = {
  en: ["Located at {location}, in a setting that is growing fast.", "Find it at {location}, where connectivity meets opportunity.", "Right at {location}, a location with a future."],
  hi: ["{location} पर स्थित, एक तेज़ी से विकसित होती जगह में।", "{location} पर, जहाँ कनेक्टिविटी और अवसर मिलते हैं।", "ठीक {location} पर, एक ऐसी लोकेशन जिसका भविष्य उज्ज्वल है।"],
  hinglish: ["{location} par located, ek tezi se grow karti jagah mein.", "{location} par, jahan connectivity aur opportunity milte hain.", "Seedha {location} par, ek aisi location jiska future bright hai."],
};

const amenities: Slot = {
  en: ["Thoughtfully planned amenities that elevate everyday living.", "Amenities designed so every day feels like a getaway."],
  hi: ["सोच-समझकर बनाई गई सुविधाएँ, जो रोज़मर्रा की ज़िंदगी को बेहतर बनाती हैं।", "ऐसी सुविधाएँ, जो हर दिन को छुट्टी जैसा बना दें।"],
  hinglish: ["Soch-samajh kar planned amenities, jo everyday living ko elevate karti hain.", "Aisi amenities, jinse har din ek getaway jaisa lage."],
};

const cta: Slot = {
  en: ["Book your site visit today.", "Visit us and see it for yourself.", "Call now and take the first step."],
  hi: ["आज ही साइट विज़िट बुक कीजिए।", "आइए, अपनी आँखों से देखिए।", "अभी कॉल कीजिए और पहला कदम बढ़ाइए।"],
  hinglish: ["Aaj hi apni site visit book kijiye.", "Aaiye, apni aankhon se dekhiye.", "Abhi call kijiye aur pehla kadam badhaiye."],
};

const mk = (variants: Slot, id: string, optionalIf?: "noTagline" | "noAmenities") => ({ id, variants, optionalIf });

export const TEMPLATES: ScriptTemplate[] = [
  {
    id: "plot-investment",
    label: "Plot — investment & land",
    types: ["plot"],
    slots: [
      mk(hook, "hook"), mk(intro, "intro"), mk(tagline, "tagline", "noTagline"), mk(location, "location"),
      mk({
        en: ["Well-planned plots with open space and room to build exactly what you imagine.", "Plots laid out with wide roads and open surroundings, ready for your dream home."],
        hi: ["सुनियोजित प्लॉट्स, खुली जगह के साथ, ताकि आप वही बनाएँ जो आपने सोचा है।", "चौड़ी सड़कों और खुले वातावरण वाले प्लॉट्स, आपके सपनों के घर के लिए तैयार।"],
        hinglish: ["Well-planned plots, open space ke saath, taaki aap wahi banao jo aapne imagine kiya.", "Wide roads aur open surroundings wale plots, aapke dream home ke liye ready."],
      }, "product"),
      mk({
        en: ["Land is the one asset that has always stood the test of time.", "A plot is not just land. It is the foundation of your family's future."],
        hi: ["ज़मीन वह संपत्ति है जिसने हमेशा वक़्त की कसौटी पर खुद को साबित किया है।", "प्लॉट सिर्फ़ ज़मीन नहीं, आपके परिवार के भविष्य की नींव है।"],
        hinglish: ["Zameen wo asset hai jisne hamesha waqt ki kasauti par khud ko prove kiya hai.", "Plot sirf zameen nahi, aapke family ke future ki foundation hai."],
      }, "benefit"),
      mk(cta, "cta"),
    ],
  },
  {
    id: "tower-skyline",
    label: "Tower / high-rise — skyline living",
    types: ["tower", "commercial"],
    slots: [
      mk(hook, "hook"), mk(intro, "intro"), mk(tagline, "tagline", "noTagline"), mk(location, "location"),
      mk({
        en: ["A tower that redefines the skyline, with homes that rise above the ordinary.", "Rising tall with a striking design, it brings a new level of city living."],
        hi: ["एक ऐसा टावर जो स्काईलाइन को नई पहचान देता है, साधारण से ऊपर उठते घरों के साथ।", "शानदार डिज़ाइन के साथ ऊँचा उठता यह टावर, शहरी जीवन को एक नया स्तर देता है।"],
        hinglish: ["Ek aisa tower jo skyline ko nayi pehchaan deta hai, ordinary se upar uthte homes ke saath.", "Striking design ke saath tall khada ye tower, city living ko naya level deta hai."],
      }, "product"),
      mk(amenities, "amenities", "noAmenities"),
      mk({
        en: ["Wake up to open views and live where the city comes to you.", "Every floor, every view, designed to feel like a statement."],
        hi: ["खुले नज़ारों के साथ जागिए और वहाँ रहिए जहाँ शहर ख़ुद आपके पास आता है।", "हर मंज़िल, हर नज़ारा, एक अलग पहचान की तरह रचा गया।"],
        hinglish: ["Open views ke saath uthiye aur wahan rahiye jahan city khud aapke paas aati hai.", "Har floor, har view, ek statement ki tarah design kiya gaya."],
      }, "benefit"),
      mk(cta, "cta"),
    ],
  },
  {
    id: "villa-lifestyle",
    label: "Villa — luxury lifestyle",
    types: ["villa"],
    slots: [
      mk(hook, "hook"), mk(intro, "intro"), mk(tagline, "tagline", "noTagline"), mk(location, "location"),
      mk({
        en: ["Private villas with generous space, light and privacy, built for how you want to live.", "Luxury villas where every corner is designed for comfort and character."],
        hi: ["निजी विला, भरपूर जगह, रोशनी और प्राइवेसी के साथ, आपके जीने के अंदाज़ के मुताबिक़।", "लग्ज़री विला, जहाँ हर कोना आराम और शान के लिए डिज़ाइन किया गया है।"],
        hinglish: ["Private villas, generous space, light aur privacy ke saath, aapke jeene ke andaaz ke mutabiq.", "Luxury villas, jahan har corner comfort aur character ke liye design kiya gaya hai."],
      }, "product"),
      mk(amenities, "amenities", "noAmenities"),
      mk({
        en: ["This is not just a home. It is a lifestyle you have earned.", "Come home to a life of space, serenity and style."],
        hi: ["यह सिर्फ़ एक घर नहीं, आपकी कमाई हुई जीवनशैली है।", "घर लौटिए एक ऐसी ज़िंदगी में जहाँ जगह, सुकून और स्टाइल तीनों हों।"],
        hinglish: ["Ye sirf ek ghar nahi, aapki earned lifestyle hai.", "Ghar lautiye ek aisi life mein jahan space, sukoon aur style teeno hon."],
      }, "benefit"),
      mk(cta, "cta"),
    ],
  },
  {
    id: "home-family",
    label: "2BHK / 3BHK — family home",
    types: ["2bhk", "3bhk"],
    slots: [
      mk(hook, "hook"), mk(intro, "intro"), mk(tagline, "tagline", "noTagline"), mk(location, "location"),
      mk({
        en: ["Smartly designed {type} homes, with space for family, light and everyday joy.", "Comfortable {type} homes planned around the way your family lives."],
        hi: ["समझदारी से डिज़ाइन किए गए {type} घर, परिवार, रोशनी और रोज़ की खुशियों के लिए।", "आरामदायक {type} घर, जो आपके परिवार के जीने के तरीक़े के हिसाब से बने हैं।"],
        hinglish: ["Smartly designed {type} homes, family, light aur everyday khushiyon ke liye.", "Comfortable {type} homes, aapki family ke jeene ke tareeke ko dhyan mein rakhkar planned."],
      }, "product"),
      mk(amenities, "amenities", "noAmenities"),
      mk({
        en: ["A home where every room has a memory waiting to happen.", "Because the right home makes everything else feel possible."],
        hi: ["एक ऐसा घर जहाँ हर कमरे में एक याद बनने का इंतज़ार कर रही है।", "क्योंकि सही घर हो तो बाक़ी सब कुछ मुमकिन लगता है।"],
        hinglish: ["Ek aisa ghar jahan har room mein ek yaad banne ka intezaar kar rahi hai.", "Kyunki sahi ghar ho toh baaki sab kuch possible lagta hai."],
      }, "benefit"),
      mk(cta, "cta"),
    ],
  },
];
