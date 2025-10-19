// Validation functions for personalization data

export function validateRealName(name) {
  if (!name || typeof name !== "string") return false;

  // Remove extra whitespace and trim
  const trimmed = name.trim();

  // Basic validation: 1-50 characters, letters, spaces, hyphens, apostrophes
  const nameRegex = /^[a-zA-ZÀ-ÿĀ-žА-яа-яЁё\s\-'\.]{1,50}$/;

  return trimmed.length >= 1 && trimmed.length <= 50 && nameRegex.test(trimmed);
}

export function validateAge(age) {
  if (!age || typeof age !== "number") return false;

  // Reasonable age range: 13-120 (Discord ToS requires 13+)
  return age >= 13 && age <= 120;
}

export function validateGender(gender) {
  if (!gender || typeof gender !== "string") return false;

  // Allow predefined options and custom validation
  const validGenders = ["male", "female", "non-binary", "other"];
  const trimmed = gender.trim().toLowerCase();

  // Must be between 1-20 characters and only contain letters
  const genderRegex = /^[a-zA-Z\-]{1,20}$/;

  return validGenders.includes(trimmed) || genderRegex.test(trimmed);
}

export function validateCountryCode(countryCode) {
  if (!countryCode || typeof countryCode !== "string") return false;

  // ISO 3166-1 alpha-2 format (2 uppercase letters)
  const countryCodeRegex = /^[A-Z]{2}$/;
  return countryCodeRegex.test(countryCode.toUpperCase());
}

export function sanitizeRealName(name) {
  if (!name) return null;
  return name.trim().replace(/\s+/g, " ").replace(/['"]/g, "");
}

export function sanitizeGender(gender) {
  if (!gender) return null;
  return gender.trim().toLowerCase();
}

export function getGenderEmoji(gender) {
  if (!gender) return null;
  const genderLower = gender.toLowerCase();

  switch (genderLower) {
    case "male":
    case "man":
    case "boy":
      return "👨";
    case "female":
    case "woman":
    case "girl":
      return "👩";
    case "non-binary":
    case "nonbinary":
      return "⚧️";
    default:
      return "🧑";
  }
}

export function formatAge(age) {
  if (!age) return null;

  if (age < 18) {
    return `${age} years old (Under 18)`;
  } else if (age < 30) {
    return `${age} years old 🌸`;
  } else if (age < 50) {
    return `${age} years old 🌟`;
  } else if (age < 70) {
    return `${age} years old 🌙`;
  } else {
    return `${age} years old 👑`;
  }
}

export function validatePersonalizationData(data) {
  const errors = {};
  const sanitized = {};

  // Validate real name
  if (data.realName !== undefined) {
    if (!validateRealName(data.realName)) {
      errors.realName =
        "Name must be 1-50 characters and contain only letters, spaces, hyphens, and apostrophes";
    } else {
      sanitized.realName = sanitizeRealName(data.realName);
    }
  }

  // Validate age
  if (data.age !== undefined) {
    if (!validateAge(data.age)) {
      errors.age = "Age must be between 13 and 120";
    } else {
      sanitized.age = Math.floor(data.age);
    }
  }

  // Validate gender
  if (data.gender !== undefined) {
    if (!validateGender(data.gender)) {
      errors.gender = "Gender must be 1-20 characters and contain only letters";
    } else {
      sanitized.gender = sanitizeGender(data.gender);
    }
  }

  // Validate country code
  if (data.countryCode !== undefined) {
    if (!validateCountryCode(data.countryCode)) {
      errors.countryCode = "Country code must be a valid 2-letter ISO code";
    } else {
      sanitized.countryCode = data.countryCode.toUpperCase();
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}
