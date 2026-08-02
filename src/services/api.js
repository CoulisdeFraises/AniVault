const WORKER_URL = "https://anivault-api.cdf-leros.workers.dev";

export async function getMediaDetails(source, id) {
  try {
    const response = await fetch(`${WORKER_URL}/api/media?source=${source}&id=${id}`);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Impossible de récupérer les détails du média :", error);
    return null;
  }
}
