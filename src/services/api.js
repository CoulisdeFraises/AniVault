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

export async function search(query, type) {
  const limit = 50; // Augmenter ce nombre selon vos besoins
  const res = await fetch(`https://<your-supabase-url>/functions/v1/media/search?query=${encodeURIComponent(query)}&type=${type}&limit=${limit}`);
  return await res.json();
}
