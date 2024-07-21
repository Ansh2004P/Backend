const FetchImageName = (url) => {
    // console.log(typeof (url))
    const parts = url.split("/")
    const fileName = parts[parts.length - 1]
    const fileNameWithoutExtension = fileName.replace(/\.[^/.]+$/, "")
    return fileNameWithoutExtension
}

export default FetchImageName
