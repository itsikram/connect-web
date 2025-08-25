import React from 'react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const SkeletonCard = ({ count = 1 }) => {
  return (
    <SkeletonTheme
      baseColor="#656565"
      highlightColor="rgba(224, 224, 224,0.3)"
      duration={1.8}  // slower shimmer like Facebook
    >
      {Array(count).fill(0).map((_, index) => (
        <div
          key={index}
          className="p-4 border rounded-lg shadow-md mb-4 w-full max-w-sm overflow-hidden"
          style={{ position: "relative" }}
        >
          <Skeleton height={200} className="mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            <Skeleton width="80%" />
          </h3>
          <p className="text-sm mb-2">
            <Skeleton count={2} />
          </p>
          <div className="flex items-center justify-between mt-4">
            <Skeleton width={80} height={30} />
            <Skeleton width={50} height={30} />
          </div>
        </div>
      ))}
    </SkeletonTheme>
  );
};

export default SkeletonCard;
