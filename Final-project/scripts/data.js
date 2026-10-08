export async function getTopics() {
  try {
    const response = await fetch("data/topics.json");
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Could not load topics:", error);
    return [];
  }
}