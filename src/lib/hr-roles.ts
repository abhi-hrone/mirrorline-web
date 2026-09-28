// Senior HR designations offered as target roles on the seed step, grouped by
// level. The selected roles are sent as the job-title filter for people search
// (see targetRoles in wizard-context.tsx), in place of the department picker.
export const HR_ROLE_GROUPS: { level: string; roles: string[] }[] = [
  {
    level: "Director level",
    roles: [
      "HR Director",
      "Director HR",
      "Director – Human Resources",
      "Director of Human Resources",
      "HR & Admin Director",
      "People Director",
      "Director – People & Culture",
    ],
  },
  {
    level: "VP level",
    roles: ["VP HR", "Vice President HR", "VP – Human Resources", "Vice President – Human Resources", "VP People"],
  },
  {
    level: "Head level",
    roles: ["Head HR", "Head – Human Resources", "Head of HR", "Head – People", "Head – HR Operations"],
  },
  {
    level: "CHRO / CPO",
    roles: ["CHRO", "Chief Human Resources Officer", "Chief People Officer"],
  },
  {
    level: "Senior leadership",
    roles: [
      "AVP HR",
      "Assistant Vice President HR",
      "SVP HR",
      "Senior Vice President HR",
      "Group HR Head",
      "Group Head HR",
      "Global Head HR",
      "Regional Head HR",
      "Country Head HR",
      "HR Business Head",
      "HRBP",
      "Human resource Business Partner",
    ],
  },
];

export const ALL_HR_ROLES: string[] = HR_ROLE_GROUPS.flatMap((g) => g.roles);
