import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import fs from "fs"

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating refresh and access token"
        )
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // Steps to register a user:
    // - get user details from frontend
    // - validate: not empty fields, email format, password length
    // - check for images, check for avatar
    // - check if user already exists
    // - upload them to cloudinary, avatar
    // - create user object - create entry in db
    // - remove password and refresh token field from response
    // - check for user creation
    // return res

    //  step 1: get user details from frontend
    const { fullName, email, username, password } = req.body
    console.log(req)
    if (
        [fullName, email, username, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // step 2: check for images, check for avatar
    let coverImageLocalPath, avatarLocalPath

    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (
        req.files &&
        Array.isArray(req.files.avatar) &&
        req.files.avatar.length > 0
    ) {
        avatarLocalPath = req.files.avatar[0].path
    } else {
        avatarLocalPath =
            "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg"
    }

    //  step 3: validate: not empty fields, email format, password length
    const existedUser = await User.findOne({
        $or: [{ email }, { username }],
    })

    if (existedUser) {
        fs.unlinkSync(coverImageLocalPath)
        fs.unlinkSync(avatarLocalPath)
        throw new ApiError(409, "User with username or email already exists")
    }

    // console.log(req.files)

    // step 4: upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    // step 5: create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage.url || "",
        email,
        password,
        username: username.toLowerCase(),
    })

    // step 6: remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // step 7: check for user creation
    if (!createdUser) {
        throw new ApiError(
            500,
            "Something went wrong while registering the user"
        )
    }

    // step 8: return response
    return res
        .status(201)
        .json(new ApiResponse(200, createdUser, "User registered Successfully"))
})

const loginUser = asyncHandler(async (req, res) => {
    // Steps to login a user:
    // - get user details from frontend {req body -> data}
    // - username or email
    // - find the user
    // - password check
    // - access and refresh token
    // - send cookie

    // step 1: get user details from frontend
    const { email, username, password } = req.body
    // pass json data, not form-data to configure form-data use multer middleware and as we do not need any files use upload.none() and other way around is use express-formidable middleware
    // console.log(req.body)

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    // step 2: find the user
    const user = await User.findOne({
        $or: [{ username }, { email }],
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    // step 3: password check
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id
    )
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options = {
        httpsOnly: true,
        secure: true,
    }
    console.log("user login succesfully")
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged in successfully"
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1, // This removes the field from document
            },
        },
        {
            new: true,
        }
    )
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .clearCookie("refreshToken", options)
        .clearCookie("accessToken", options)
        .json(new ApiResponse(200, {}, "User logged Out successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const incomingRefreshToken =
            req.cookies.refreshToken || req.body.refreshToken

        if (!incomingRefreshToken) {
            throw new ApiError(401, "unauhorized request")
        }

        const decodeToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodeToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true,
        }

        const { accessToken, newRefreshToken } =
            await generateAccessAndRefreshToken(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed successfully"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "User fetched successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
}
