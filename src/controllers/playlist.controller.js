import mongoose, { isValidObjectId } from "mongoose"
import { Playlist } from "../models/playlist.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"
import { Video } from "../models/video.model.js"

const isUserOwnerofPlaylist = async (playlistId, userId) => {
    try {
        const playlist = await Playlist.findById(playlistId)

        if (!playlist) {
            throw new ApiError(404, "Playlist not found")
        }

        if (playlist?.owner.toString() !== userId.toString()) {
            return false
        }
        return true
    } catch (error) {
        throw new ApiError(500, "Unable to verify user ownership")
    }
}

const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description, videos } = req.body
    //TODO: create playlist
    if (!name) {
        throw new ApiError(400, "Name is required")
    }
    let playListDescription = description || ""

    let videoIds = []
    if (videos && Array.isArray(videos)) {
        videoIds = videos
    }

    try {
        const playlist = await Playlist.create({
            name,
            description: playListDescription,
            owner: req.user?._id,
            videos: videoIds,
        })
        if (!playlist) {
            throw new ApiError(500, "Unable to create playlist")
        }
        return res
            .status(200)
            .json(
                new ApiResponse(200, playlist, "Playlist created successfully")
            )
    } catch (error) {
        throw new ApiError(500, "Unable to create playlist")
    }
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    //TODO: get user playlists

    const { userId } = req.params
    if (!userId) {
        throw new ApiError(400, "User id is required")
    }

    try {
        const user = await User.findbyId(userId)
        if (!user) {
            throw new ApiError(404, "User not found")
        }
        const playlist = await Playlist.aggregate([
            {
                $match: {
                    owner: { $eq: { $toObjectId: userId } },
                },
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    owner: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    videos: {
                        $cond: {
                            if: {
                                $eq: ["$owner", { $toObjectId: req.user?._id }],
                            },
                            them: "$videos",
                            else: {
                                $filter: {
                                    input: "$videos",
                                    as: "video",
                                    cond: {
                                        $eq: ["$video.isPublished", true],
                                    },
                                },
                            },
                        },
                    },
                },
            },
        ])

        if (!playlist) {
            throw new ApiError(404, "There is no Playlist made by this user")
        }

        return res
            .status(200)
            .json(
                new ApiResponse(200, playlist, "Playlist Fetched Successfully")
            )
    } catch (error) {
        throw new ApiError(500, error?.message || "Unable to fetch playlist")
    }
})

const getPlaylistById = asyncHandler(async (req, res) => {
    //TODO: get playlist by id

    const { playlistId } = req.params
    if (!playlistId) {
        throw new ApiError(400, "PlaylistId is required!!")
    }

    try {
        const playlist = await Playlist.aggregate([
            {
                $match: {
                    _id: { $eq: { $toObjectId: playlistId } },
                },
            },
            {
                //if the user is the owner of the playlist then return all the videos(public and private)
                //  else return only public videos
                $project: {
                    name: 1,
                    description: 1,
                    owner: 1,
                    videos: {
                        $cond: {
                            if: {
                                $eq: ["$owner", { $toObjectId: req.user?._id }],
                            },
                            then: "$videos",
                            else: {
                                $filter: {
                                    input: "$videos",
                                    as: "video",
                                    cond: {
                                        $eq: ["$video.isPublished", true],
                                    },
                                },
                            },
                        },
                    },
                    createdAt: 1,
                    updatedAt: 1,
                },
            },
        ])
        if (!playlist) {
            throw new ApiError(404, "Playlist Not Found")
        }
        return res
            .status(200)
            .json(
                new ApiResponse(200, playlist, "Playlist Fetched Successfully")
            )
    } catch (error) {
        throw new ApiError(500, error?.message || "Unable to fetch playlist")
    }
})

const addVideosToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { videoIds } = req.body

    if (!playlistId || !Array.isArray(videoIds) || videoIds.length === 0) {
        throw new ApiError(
            400,
            "Playlist id and an array of video ids are required"
        )
    }

    try {
        // Check if the user owns the playlist
        const userOwner = await isUserOwnerofPlaylist(playlistId, req.user?._id)
        if (!userOwner) {
            throw new ApiError(300, "Unauthorized access")
        }

        // Validate playlist ID
        if (!mongoose.isValidObjectId(playlistId)) {
            throw new ApiError(400, "Invalid playlist ID")
        }

        // Fetch videos and filter out invalid or unauthorized videos in a single query
        const validVideoIds = await Video.aggregate([
            {
                $match: {
                    _id: {
                        $in: videoIds.map((id) => mongoose.Types.ObjectId(id)),
                    },
                    $or: [
                        { isPublished: true },
                        { owner: mongoose.Types.ObjectId(req.user._id) },
                    ],
                },
            },
            {
                $project: { _id: 1 },
            },
        ]).exec()

        const validVideoIdStrings = validVideoIds.map((video) =>
            video._id.toString()
        )

        if (validVideoIdStrings.length === 0) {
            throw new ApiError(
                404,
                "No valid videos found to add to the playlist"
            )
        }

        // Add valid videos to the playlist using aggregation pipeline
        const result = await Playlist.updateOne(
            { _id: mongoose.Types.ObjectId(playlistId) },
            {
                $addToSet: { videos: { $each: validVideoIdStrings } },
            }
        )

        if (!result.nModified) {
            throw new ApiError(500, "Unable to add the videos to the playlist")
        }

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    result,
                    "Videos successfully added to playlist"
                )
            )
    } catch (error) {
        throw new ApiError(
            500,
            error?.message || "Unable to add videos to playlist"
        )
    }
})

const removeVideosFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { videoIds } = req.body

    if (!playlistId || !Array.isArray(videoIds) || videoIds.length === 0) {
        throw new ApiError(
            400,
            "Playlist id and an array of video ids are required"
        )
    }

    try {
        // Check if the user owns the playlist
        const userOwner = await isUserOwnerofPlaylist(playlistId, req.user?._id)
        if (!userOwner) {
            throw new ApiError(300, "Unauthorized access")
        }

        // Validate playlist ID
        if (!mongoose.isValidObjectId(playlistId)) {
            throw new ApiError(400, "Invalid playlist ID")
        }

        // Validate video IDs and filter out those that exist in the playlist
        const validVideoIds = await Video.aggregate([
            {
                $match: {
                    _id: {
                        $in: videoIds.map((id) => mongoose.Types.ObjectId(id)),
                    },
                },
            },
            {
                $project: { _id: 1 },
            },
        ]).exec()

        const validVideoIdStrings = validVideoIds.map((video) =>
            video._id.toString()
        )

        // Find which of the valid videos are in the playlist
        const playlist = await Playlist.findById(playlistId)
        if (!playlist) {
            throw new ApiError(404, "Playlist not found")
        }

        const videosToRemove = validVideoIdStrings.filter((videoId) =>
            playlist.videos.includes(videoId)
        )

        if (videosToRemove.length === 0) {
            return res
                .status(200)
                .json(
                    new ApiResponse(
                        200,
                        {},
                        "No valid videos found in the playlist to remove"
                    )
                )
        }

        // Remove videos from the playlist
        const result = await Playlist.updateOne(
            { _id: mongoose.Types.ObjectId(playlistId) },
            {
                $pullAll: { videos: videosToRemove },
            }
        )

        if (!result.nModified) {
            throw new ApiError(
                500,
                "Unable to remove the videos from the playlist"
            )
        }

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    result,
                    "Videos successfully removed from playlist"
                )
            )
    } catch (error) {
        throw new ApiError(
            500,
            error?.message || "Unable to remove videos from playlist"
        )
    }
})

const deletePlaylist = asyncHandler(async (req, res) => {
    // TODO: delete playlist

    const { playlistId } = req.params
    if (!playlistId) {
        throw new ApiError(400, "Playlist id is required")
    }

    try {
        const userOwner = await isUserOwnerofPlaylist(playlistId, req.user?._id)
        if (!userOwner) {
            throw new ApiError(300, "Unauthorized access")
        }
        const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId)
        if (!deletedPlaylist) {
            throw new ApiError(500, "Unable to delete playlist")
        }
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    deletedPlaylist,
                    "Playlist deleted successfully"
                )
            )
    } catch (error) {
        throw new ApiError(500, error?.message || "Unable to delete playlist")
    }
})

const updatePlaylist = asyncHandler(async (req, res) => {
    //TODO: update playlist

    const { playlistId } = req.params
    const { name, description } = req.body
    if (!playlistId) {
        throw new ApiError(400, "Playlist id is required")
    }

    try {
        const userOwner = await isUserOwnerofPlaylist(playlistId, req.user?._id)
        if (!userOwner) {
            throw new ApiError(300, "Unauthorized access")
        }
        if (!name || !description) {
            throw new ApiError(400, "Name and Description is required")
        }

        const updatedPlaylist = await Playlist.findByIdAndUpdate(playlistId, {
            $set: {
                name,
                description,
            },
        })

        if (!updatedPlaylist) {
            throw new ApiError(500, "Unable to update playlist")
        }

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    updatedPlaylist,
                    "Playlist updated successfully"
                )
            )
    } catch (error) {
        throw new ApiError(500, error?.message || "Unable to update playlist")
    }
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideosToPlaylist,
    removeVideosFromPlaylist,
    deletePlaylist,
    updatePlaylist,
}
