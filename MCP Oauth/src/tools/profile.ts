/**
 * Tool: get_user_profile
 * Returns the profile of the currently authenticated user.
 * Demonstrates using the OAuth token's subject claim to identify the caller.
 */

export interface UserProfile {
  userId:      string;
  name:        string;
  email:       string;
  role:        string;
  department:  string;
  title:       string;
  avatar:      string;
  timezone:    string;
  joinedDate:  string;
  permissions: string[];
}

// Extended user profiles (keyed by userId from JWT sub claim)
const PROFILES: Record<string, UserProfile> = {
  "user1": {
    userId:     "user1",
    name:       "Alice Johnson",
    email:      "alice@example.com",
    role:       "admin",
    department: "Engineering",
    title:      "Senior Software Engineer",
    avatar:     "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
    timezone:   "America/New_York",
    joinedDate: "2022-03-15",
    permissions: ["tools:read", "tools:write", "tasks:read", "tasks:write", "profile:read"],
  },
  "user2": {
    userId:     "user2",
    name:       "Bob Smith",
    email:      "bob@example.com",
    role:       "member",
    department: "Product",
    title:      "Product Manager",
    avatar:     "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
    timezone:   "America/Los_Angeles",
    joinedDate: "2023-06-01",
    permissions: ["tools:read", "tasks:read", "profile:read"],
  },
};

// For client_credentials tokens (no user context), return a service account profile
const SERVICE_PROFILE: UserProfile = {
  userId:     "service-account",
  name:       "Service Account",
  email:      "service@example.com",
  role:       "service",
  department: "Automation",
  title:      "Automated Service Account",
  avatar:     "",
  timezone:   "UTC",
  joinedDate: "2020-01-01",
  permissions: ["tools:read", "tools:write", "tasks:read", "tasks:write", "profile:read"],
};

export function getUserProfile(userId: string): UserProfile {
  return PROFILES[userId] ?? { ...SERVICE_PROFILE, userId };
}

export function hasPermission(userId: string, permission: string): boolean {
  const profile = PROFILES[userId];
  if (!profile) return SERVICE_PROFILE.permissions.includes(permission);
  return profile.permissions.includes(permission);
}
