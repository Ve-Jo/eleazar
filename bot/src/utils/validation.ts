type PersonalizationInput = {
  realName?: string;
  age?: number;
  gender?: string;
  countryCode?: string;
};

type ValidationResult = {
  isValid: boolean;
  errors: Record<string, string>;
  sanitized: Record<string, string | number | null>;
};

function validateRealName(name: string | null | undefined): boolean {
  if (!name || typeof name !== "string") {
    return false;
  }

  const trimmed = name.trim();
  const nameRegex = /^[a-zA-ZÀ-ÿĀ-žА-яа-яЁё\s\-'\.]{1,50}$/;

  return trimmed.length >= 1 && trimmed.length <= 50 && nameRegex.test(trimmed);
}

function validateAge(age: number | null | undefined): boolean {
  if (!age || typeof age !== "number") {
    return false;
  }

  return age >= 13 && age <= 120;
}

function validateGender(gender: string | null | undefined): boolean {
  if (!gender || typeof gender !== "string") {
    return false;
  }

  const validGenders = ["male", "female", "non-binary", "other"];
  const trimmed = gender.trim().toLowerCase();
  const genderRegex = /^[a-zA-Z\-]{1,20}$/;

  return validGenders.includes(trimmed) || genderRegex.test(trimmed);
}

function validateCountryCode(countryCode: string | null | undefined): boolean {
  if (!countryCode || typeof countryCode !== "string") {
    return false;
  }

  const countryCodeRegex = /^[A-Z]{2}$/;
  return countryCodeRegex.test(countryCode.toUpperCase());
}

function sanitizeRealName(name: string | null | undefined): string | null {
  if (!name) {
    return null;
  }
  return name.trim().replace(/\s+/g, " ").replace(/['"]/g, "");
}

function sanitizeGender(gender: string | null | undefined): string | null {
  if (!gender) {
    return null;
  }
  return gender.trim().toLowerCase();
}

function getGenderEmoji(gender: string | null | undefined): string | null {
  if (!gender) {
    return null;
  }
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

function formatAge(age: number | null | undefined): string | null {
  if (!age) {
    return null;
  }

  if (age < 18) {
    return `${age} years old (Under 18)`;
  }
  if (age < 30) {
    return `${age} years old 🌸`;
  }
  if (age < 50) {
    return `${age} years old 🌟`;
  }
  if (age < 70) {
    return `${age} years old 🌙`;
  }
  return `${age} years old 👑`;
}

function validatePersonalizationData(data: PersonalizationInput): ValidationResult {
  const errors: Record<string, string> = {};
  const sanitized: Record<string, string | number | null> = {};

  if (data.realName !== undefined) {
    if (!validateRealName(data.realName)) {
      errors.realName =
        "Name must be 1-50 characters and contain only letters, spaces, hyphens, and apostrophes";
    } else {
      sanitized.realName = sanitizeRealName(data.realName);
    }
  }

  if (data.age !== undefined) {
    if (!validateAge(data.age)) {
      errors.age = "Age must be between 13 and 120";
    } else {
      sanitized.age = Math.floor(data.age);
    }
  }

  if (data.gender !== undefined) {
    if (!validateGender(data.gender)) {
      errors.gender = "Gender must be 1-20 characters and contain only letters";
    } else {
      sanitized.gender = sanitizeGender(data.gender);
    }
  }

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

export {
  validateRealName,
  validateAge,
  validateGender,
  validateCountryCode,
  sanitizeRealName,
  sanitizeGender,
  getGenderEmoji,
  formatAge,
  validatePersonalizationData,
};
