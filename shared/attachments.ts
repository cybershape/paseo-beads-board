import { defineAttachmentSource } from "@getpaseo/plugin";
import { searchBeads } from "./beads";

export const beadsAttachmentSource = defineAttachmentSource({
  id: "beads",
  title: "Beads issue",
  icon: "CircleDot",
  pickerTitle: "Attach a beads issue",
  searchPlaceholder: "Search by ID or title",
  search: searchBeads,
});
