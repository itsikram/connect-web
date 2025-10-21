    const checkImgLoading = (url,setLoaded) => {
        const img = new Image();
        img.src = url;

        img.onload = () => setLoaded(true);
        img.onerror = () => setLoaded(false);
    };

    export default checkImgLoading