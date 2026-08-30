import React from "react";

const NAME_WIDTHS = ["68%", "78%", "58%", "72%"];

const FgiSkleton = ({ count = 8 }) => {
    return Array(count)
        .fill(0)
        .map((_, index) => (
            <div
                className="friend-grid-item fgi-skeleton"
                key={index}
                aria-hidden="true"
            >
                <div className="profile-picture fgi-skeleton-photo" />
                <div className="grid-body">
                    <h5 className="profile-name">
                        <span
                            className="fgi-skeleton-line"
                            style={{ width: NAME_WIDTHS[index % NAME_WIDTHS.length] }}
                        />
                    </h5>
                    <div className="primary-button button fgi-skeleton-btn" />
                    <div className="button fgi-skeleton-btn" />
                </div>
            </div>
        ));
};

export default FgiSkleton;
